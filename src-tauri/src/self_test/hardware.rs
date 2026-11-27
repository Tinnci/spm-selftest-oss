use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use quick_xml::{Reader, events::Event};

use super::run_adb;

const ACTIVE_SCRIPT: &str = include_str!("hardware.sh");
const INVENTORY_SCRIPT: &str = include_str!("hardware_inventory.sh");
const DUMP_UI: &str = r#"
    xml=$(mktemp /data/local/tmp/spm-mmi.XXXXXX) || exit 1
    trap 'rm -f "$xml"' EXIT
    uiautomator dump "$xml" >/dev/null && cat "$xml"
"#;
const MMI_ACTION: &str = "com.sprocomm.mmi.MainDeviceInfo";
const UNISOC_ACTIVITY: &str = "com.sprd.validationtools/com.sprd.validationtools.MainDeviceInfo";
const MTK_ACTIVITY: &str = "com.mtk.qti.qmmicustom/com.mtk.qti.qmmicustom.MainDeviceInfo";
const MAX_MMI_SCREENS: usize = 6;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HardwareRead {
    pub source: String,
    pub status: String,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct HardwareSnapshot {
    pub active: BTreeMap<String, HardwareRead>,
    pub inventory: BTreeMap<String, Vec<String>>,
    pub inventory_sources: BTreeMap<String, BTreeMap<String, String>>,
    pub mmi: BTreeMap<String, String>,
    pub mmi_status: String,
    pub issues: Vec<String>,
}

fn parse_active(raw: &str, snapshot: &mut HardwareSnapshot) {
    for line in raw.lines() {
        let parts = line.splitn(5, '\t').collect::<Vec<_>>();
        let ["A", key, status, source, value] = parts.as_slice() else {
            continue;
        };
        let row = snapshot
            .active
            .entry((*key).to_owned())
            .or_insert_with(|| HardwareRead {
                source: (*source).to_owned(),
                status: (*status).to_owned(),
                values: Vec::new(),
            });
        let value = value.trim();
        if !value.is_empty() && !row.values.iter().any(|existing| existing == value) {
            row.values.push(value.to_owned());
        }
    }
}

fn parse_inventory(raw: &str, snapshot: &mut HardwareSnapshot) {
    let mut paths: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for line in raw.lines() {
        let parts = line.splitn(4, '\t').collect::<Vec<_>>();
        match parts.as_slice() {
            ["I", group, path] if path.starts_with('/') => {
                paths
                    .entry((*group).to_owned())
                    .or_default()
                    .insert((*path).to_owned());
            }
            ["S", group, status, root] => {
                snapshot
                    .inventory_sources
                    .entry((*group).to_owned())
                    .or_default()
                    .insert((*root).to_owned(), (*status).to_owned());
            }
            _ => {}
        }
    }
    snapshot.inventory = paths
        .into_iter()
        .map(|(group, entries)| (group, entries.into_iter().collect()))
        .collect();
}

async fn shell(adb: &Path, serial: &str, args: &[&str]) -> Result<String, String> {
    let mut command = vec!["-s", serial, "shell"];
    command.extend_from_slice(args);
    run_adb(adb, &command).await
}

fn known_activity(raw: &str) -> Option<&'static str> {
    [UNISOC_ACTIVITY, MTK_ACTIVITY]
        .into_iter()
        .find(|activity| {
            let (package, _) = activity.split_once('/').unwrap();
            raw.contains(activity) || raw.contains(&format!("{package}/.MainDeviceInfo"))
        })
}

async fn foreground_mmi(adb: &Path, serial: &str) -> Result<Option<&'static str>, String> {
    let raw = shell(adb, serial, &["dumpsys", "activity", "activities"]).await?;
    Ok(raw
        .lines()
        .find(|line| line.contains("topResumedActivity"))
        .or_else(|| raw.lines().find(|line| line.contains("mResumedActivity")))
        .and_then(known_activity))
}

#[derive(Debug, PartialEq, Eq)]
struct ScrollBounds {
    x: i32,
    top: i32,
    bottom: i32,
}

fn scroll_bounds(value: &str) -> Option<ScrollBounds> {
    let numbers: Vec<i32> = value
        .split(['[', ']', ','])
        .filter(|part| !part.is_empty())
        .map(str::parse)
        .collect::<Result<_, _>>()
        .ok()?;
    let [left, top, right, bottom] = numbers.as_slice() else {
        return None;
    };
    if *left < 0
        || *top < 0
        || *right > 16384
        || *bottom > 16384
        || right <= left
        || bottom <= top
        || bottom - top < 80
    {
        return None;
    }
    let margin = (bottom - top) / 8;
    Some(ScrollBounds {
        x: left + (right - left) / 2,
        top: top + margin,
        bottom: bottom - margin,
    })
}

#[derive(Debug, Default, PartialEq, Eq)]
struct MmiScreen {
    fields: BTreeMap<String, String>,
    scroll: Option<ScrollBounds>,
    visible: bool,
}

fn parse_mmi(raw: &str, package: &str) -> Option<MmiScreen> {
    let mut reader = Reader::from_str(raw);
    let mut screen = MmiScreen::default();
    loop {
        match reader.read_event().ok()? {
            Event::Start(node) | Event::Empty(node) if node.name().as_ref() == "node" => {
                let mut attributes = BTreeMap::new();
                for attr in node.attributes().flatten() {
                    let value = attr
                        .normalized_value(quick_xml::XmlVersion::Implicit1_0)
                        .ok()?;
                    attributes.insert(attr.key.as_ref().to_owned(), value);
                }
                if attributes.get("package").map(|v| v.as_ref()) != Some(package) {
                    continue;
                }
                screen.visible = true;
                if attributes.get("scrollable").map(|v| v.as_ref()) == Some("true") {
                    screen.scroll = attributes
                        .get("bounds")
                        .and_then(|value| scroll_bounds(value));
                }
                let (Some(id), Some(text)) =
                    (attributes.get("resource-id"), attributes.get("text"))
                else {
                    continue;
                };
                if let Some((_, name)) = id.split_once(":id/")
                    && !text.trim().is_empty()
                    && matches!(
                        name,
                        "version_info"
                            | "flash_info"
                            | "emmc_fwrev_info"
                            | "emmc_prv_info"
                            | "camera"
                            | "rear_camera"
                            | "front_camera"
                            | "lcd_info"
                            | "tp_info"
                            | "fp_info"
                            | "gsensor_info"
                            | "psensor_info"
                            | "alssensor_info"
                            | "msensor_info"
                            | "gyrosensor_info"
                            | "gyro_sensor_info"
                            | "nfc_info"
                            | "bandversion_info"
                            | "modem_info"
                            | "battery_info"
                            | "flags_info"
                            | "light_info"
                            | "shoulder_info"
                            | "barosensor_info"
                    )
                {
                    screen
                        .fields
                        .insert(name.to_owned(), text.trim().to_owned());
                }
            }
            Event::Eof => return Some(screen),
            _ => {}
        }
    }
}

async fn mmi_screen(adb: &Path, serial: &str, package: &str) -> Option<MmiScreen> {
    let xml = shell(adb, serial, &[DUMP_UI]).await.ok()?;
    parse_mmi(&xml, package).filter(|screen| screen.visible)
}

async fn swipe(adb: &Path, serial: &str, bounds: &ScrollBounds, down: bool) -> bool {
    let (from, to) = if down {
        (bounds.bottom, bounds.top + (bounds.bottom - bounds.top) / 3)
    } else {
        (bounds.top, bounds.bottom)
    };
    let x = bounds.x.to_string();
    let duration = if down { "650" } else { "400" };
    shell(
        adb,
        serial,
        &[
            "input",
            "swipe",
            &x,
            &from.to_string(),
            &x,
            &to.to_string(),
            duration,
        ],
    )
    .await
    .is_ok()
}

async fn collect_mmi(adb: &Path, serial: &str, board: &str, snapshot: &mut HardwareSnapshot) {
    let original = match foreground_mmi(adb, serial).await {
        Ok(original) => original,
        Err(_) => {
            snapshot.mmi_status = "failed".into();
            return;
        }
    };
    let activity = match original {
        Some(activity) => activity,
        None => {
            let package = if board.starts_with("mt") {
                "com.mtk.qti.qmmicustom"
            } else {
                "com.sprd.validationtools"
            };
            let raw = shell(
                adb,
                serial,
                &[
                    "cmd",
                    "package",
                    "query-activities",
                    "--brief",
                    "-a",
                    MMI_ACTION,
                ],
            )
            .await;
            let Ok(raw) = raw else {
                snapshot.mmi_status = "failed".into();
                return;
            };
            let target = if package == "com.mtk.qti.qmmicustom" {
                MTK_ACTIVITY
            } else {
                UNISOC_ACTIVITY
            };
            let found = raw.lines().filter_map(known_activity).collect::<Vec<_>>();
            let Some(activity) = found
                .iter()
                .copied()
                .find(|activity| *activity == target)
                .or_else(|| found.first().copied())
            else {
                snapshot.mmi_status = "unavailable".into();
                return;
            };
            if shell(adb, serial, &["am", "start", "-W", "-n", activity])
                .await
                .is_err()
            {
                snapshot.mmi_status = "failed".into();
                return;
            }
            activity
        }
    };

    let (package, _) = activity.split_once('/').unwrap();
    let mut complete = false;
    let mut reset = None;
    let mut screen = mmi_screen(adb, serial, package).await;
    if original.is_some()
        && let Some(bounds) = screen.as_ref().and_then(|screen| screen.scroll.as_ref())
    {
        for _ in 0..3 {
            if !swipe(adb, serial, bounds, false).await {
                break;
            }
        }
        screen = mmi_screen(adb, serial, package).await;
    }
    let mut previous = None;
    for _ in 0..MAX_MMI_SCREENS {
        let Some(current) = screen else { break };
        snapshot.mmi.extend(current.fields.clone());
        if previous.as_ref() == Some(&current.fields) || current.scroll.is_none() {
            complete = true;
            break;
        }
        previous = Some(current.fields);
        reset = current.scroll;
        if !swipe(adb, serial, reset.as_ref().unwrap(), true).await {
            break;
        }
        screen = mmi_screen(adb, serial, package).await;
    }
    if foreground_mmi(adb, serial).await.ok().flatten() == Some(activity) {
        if original.is_none() {
            let _ = shell(adb, serial, &["input", "keyevent", "KEYCODE_BACK"]).await;
        } else if let Some(bounds) = reset {
            for _ in 0..MAX_MMI_SCREENS {
                if !swipe(adb, serial, &bounds, false).await {
                    break;
                }
            }
        }
    }
    snapshot.mmi_status = if snapshot.mmi.is_empty() {
        "unreadable"
    } else if complete {
        "ok"
    } else {
        "partial"
    }
    .into();
}

pub async fn collect_hardware(
    adb: &Path,
    serial: &str,
    properties: &BTreeMap<String, String>,
) -> HardwareSnapshot {
    let mut snapshot = HardwareSnapshot::default();
    let board = properties
        .get("ro.board.platform")
        .map_or("", String::as_str);
    let mut mmi = HardwareSnapshot::default();
    let active_script = ACTIVE_SCRIPT.replace("\r\n", "\n");
    let inventory_script = INVENTORY_SCRIPT.replace("\r\n", "\n");
    let active_command = [active_script.as_str()];
    let inventory_command = [inventory_script.as_str()];
    let (active, inventory, ()) = tokio::join!(
        shell(adb, serial, &active_command),
        shell(adb, serial, &inventory_command),
        collect_mmi(adb, serial, board, &mut mmi),
    );
    match active {
        Ok(raw) => parse_active(&raw, &mut snapshot),
        Err(_) => snapshot.issues.push("active".into()),
    }
    match inventory {
        Ok(raw) => parse_inventory(&raw, &mut snapshot),
        Err(_) => snapshot.issues.push("inventory".into()),
    }
    snapshot.mmi = mmi.mmi;
    snapshot.mmi_status = mmi.mmi_status;
    snapshot
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hardware_read_preserves_denials_and_deduplicates_inventory() {
        let mut snapshot = HardwareSnapshot::default();
        parse_active(
            "A\ttp\tdenied\t/proc/Sprocomm_TpInfo\t\r\nA\tsensors\tok\tdumpsys sensorservice\tone\nA\tsensors\tok\tdumpsys sensorservice\ttwo\n",
            &mut snapshot,
        );
        parse_inventory(
            "I\tfirmware\t/vendor/firmware/tp.bin\nI\tfirmware\t/vendor/firmware/tp.bin\nS\tfirmware\tpartial\t/vendor/firmware\n",
            &mut snapshot,
        );
        assert_eq!(snapshot.active["tp"].status, "denied");
        assert!(snapshot.active["tp"].values.is_empty());
        assert_eq!(snapshot.active["sensors"].values, ["one", "two"]);
        assert_eq!(snapshot.inventory["firmware"], ["/vendor/firmware/tp.bin"]);
        assert_eq!(
            snapshot.inventory_sources["firmware"]["/vendor/firmware"],
            "partial"
        );
    }

    #[cfg(unix)]
    #[test]
    fn inventory_keeps_visible_names_when_file_metadata_is_denied() {
        let fake_find = r#"
            find() {
                case "$1" in
                    /vendor/firmware/)
                        printf "find: '%s': Permission denied\n" /vendor/firmware/tp.bin >&2
                        return 1 ;;
                    /sys/firmware/devicetree/base/)
                        printf '%s\n' /sys/firmware/devicetree/base/lcds/lcd_test
                        return 0 ;;
                    *) return 1 ;;
                esac
            }
        "#;
        let output = std::process::Command::new("sh")
            .args(["-c", &format!("{fake_find}\n{INVENTORY_SCRIPT}")])
            .output()
            .unwrap();
        assert!(output.status.success());
        assert!(output.stderr.is_empty());
        let mut snapshot = HardwareSnapshot::default();
        parse_inventory(std::str::from_utf8(&output.stdout).unwrap(), &mut snapshot);
        assert_eq!(snapshot.inventory["firmware"], ["/vendor/firmware/tp.bin"]);
        assert_eq!(
            snapshot.inventory_sources["firmware"]["/vendor/firmware"],
            "partial"
        );
        assert_eq!(
            snapshot.inventory["device_tree"],
            ["/sys/firmware/devicetree/base/lcds/lcd_test"]
        );
    }

    #[test]
    fn mmi_xml_keeps_multiline_flags_and_filters_unrelated_views() {
        let screen = parse_mmi(
            r#"<hierarchy>
                <node package="com.sprd.validationtools" scrollable="true" bounds="[0,100][720,1500]">
                    <node package="com.sprd.validationtools" resource-id="com.sprd.validationtools:id/flags_info" text="FT:PASS&#10;MMI2:FAIL"/>
                    <node package="com.sprd.validationtools" resource-id="com.sprd.validationtools:id/serial" text="00001"/>
                    <node package="android" resource-id="android:id/tp_info" text="unrelated"/>
                </node>
            </hierarchy>"#,
            "com.sprd.validationtools",
        ).unwrap();
        assert!(screen.visible);
        assert_eq!(screen.fields.len(), 1);
        assert_eq!(screen.fields["flags_info"], "FT:PASS\nMMI2:FAIL");
        assert_eq!(screen.scroll.unwrap().x, 360);
    }
}
