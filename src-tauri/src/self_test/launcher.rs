use std::path::Path;

use super::*;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LauncherItem {
    pub id: String,
    pub container: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    pub screen: i32,
    pub cell_x: i32,
    pub cell_y: i32,
    pub span_x: i32,
    pub span_y: i32,
    #[serde(default)]
    pub rank: i32,
    pub item_type: String,
    pub title: String,
    pub package: String,
    pub component: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LauncherLayout {
    pub collected_at: String,
    pub default_launcher: String,
    pub launcher_package: String,
    pub display_size: String,
    pub display_density: String,
    pub grid_columns: u32,
    pub grid_rows: u32,
    pub hotseat_count: u32,
    pub source: String,
    pub items: Vec<LauncherItem>,
    #[serde(default)]
    pub notes: Vec<String>,
}

pub fn parse_default_launcher(shortcut_out: &str, resolve_out: &str) -> (String, String) {
    let pick_component = |raw: &str| -> Option<String> {
        for line in raw.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("priority=") {
                continue;
            }
            for token in trimmed.split_whitespace() {
                if token.contains('/') && token.contains('.') {
                    let clean = token
                        .trim_matches(|c: char| matches!(c, '{' | '}' | ',' | ';' | '"'))
                        .strip_prefix("ComponentInfo{")
                        .unwrap_or_else(|| {
                            token.trim_matches(|c: char| matches!(c, '{' | '}' | ',' | ';' | '"'))
                        });
                    return Some(clean.to_owned());
                }
            }
        }
        None
    };

    let component = pick_component(shortcut_out)
        .or_else(|| pick_component(resolve_out))
        .unwrap_or_default();
    let package = component.split('/').next().unwrap_or("").trim().to_owned();
    (component, package)
}

pub fn parse_wm_size(raw: &str) -> String {
    let mut override_size = None;
    let mut physical_size = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("Override size:") {
            override_size = Some(val.trim().to_owned());
        } else if let Some(val) = trimmed.strip_prefix("Physical size:") {
            physical_size = Some(val.trim().to_owned());
        }
    }
    override_size.or(physical_size).unwrap_or_default()
}

pub fn parse_wm_density(raw: &str) -> String {
    let mut override_density = None;
    let mut physical_density = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("Override density:") {
            override_density = Some(val.trim().to_owned());
        } else if let Some(val) = trimmed.strip_prefix("Physical density:") {
            physical_density = Some(val.trim().to_owned());
        }
    }
    override_density.or(physical_density).unwrap_or_default()
}

fn extract_attr(line: &str, key: &str) -> Option<String> {
    let needle = format!("{key}=");
    let pos = line.find(&needle)?;
    let rest = &line[pos + needle.len()..];
    if let Some(after_quote) = rest.strip_prefix('"') {
        let end = after_quote.find('"')?;
        return Some(after_quote[..end].to_owned());
    }
    let end = rest.find([' ', ',', ')', ']']).unwrap_or(rest.len());
    let val = rest[..end].trim();
    (!val.is_empty()).then(|| val.to_owned())
}

fn extract_pair(line: &str, key: &str) -> Option<(i32, i32)> {
    let needle = format!("{key}(");
    let pos = line.find(&needle)?;
    let rest = &line[pos + needle.len()..];
    let end = rest.find(')')?;
    let (a, b) = rest[..end].split_once(',')?;
    Some((a.trim().parse().ok()?, b.trim().parse().ok()?))
}

fn component_from_intent(raw: &str) -> String {
    if let Some(cmp_pos) = raw.find("cmp=") {
        let rest = &raw[cmp_pos + 4..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == ';')
            .unwrap_or(rest.len());
        return rest[..end].trim().to_owned();
    }
    if let Some(slash) = raw.find('/') {
        let start = raw[..slash]
            .rfind(|c: char| c.is_whitespace() || c == '=' || c == '{')
            .map(|i| i + 1)
            .unwrap_or(0);
        let end = raw[slash..]
            .find(|c: char| c.is_whitespace() || c == '}' || c == ',' || c == ';')
            .map(|i| slash + i)
            .unwrap_or(raw.len());
        let cand = raw[start..end].trim();
        if cand.contains('.') {
            return cand.to_owned();
        }
    }
    String::new()
}

fn classify_container(container_num: i32) -> (&'static str, Option<String>) {
    match container_num {
        -100 => ("workspace", None),
        -101 => ("hotseat", None),
        id if id > 0 => ("folder", Some(id.to_string())),
        _ => ("other", None),
    }
}

fn extract_colon_u32(line: &str, key: &str) -> Option<u32> {
    let needle = format!("{key}:");
    let pos = line.find(&needle)?;
    let rest = line[pos + needle.len()..].trim();
    rest.split_whitespace().next()?.parse::<u32>().ok()
}

fn extract_component_value(raw: &str) -> Option<String> {
    if let Some(after) = raw.strip_prefix("ComponentInfo{") {
        let end = after.find('}').unwrap_or(after.len());
        let val = after[..end].trim();
        return (!val.is_empty() && val != "null").then(|| val.to_owned());
    }
    let val = raw.trim();
    (!val.is_empty() && val != "null").then(|| val.to_owned())
}

fn extract_title_value(line: &str) -> String {
    let Some(pos) = line.find("title=") else {
        return String::new();
    };
    let rest = &line[pos + 6..];
    if let Some(after_quote) = rest.strip_prefix('"') {
        let end = after_quote.find('"').unwrap_or(after_quote.len());
        return after_quote[..end].trim().to_owned();
    }
    let mut end = rest.len();
    for marker in [
        " supportsMultiInstance=",
        " nonResizeable=",
        " providerName=",
        " appWidgetId=",
        " component=",
        " screen=",
        " cell(",
        " span(",
        ";",
        ")",
    ] {
        if let Some(idx) = rest.find(marker) {
            end = end.min(idx);
        }
    }
    let val = rest[..end].trim();
    if val == "null" {
        String::new()
    } else {
        val.to_owned()
    }
}

fn coalesce_launcher_records(raw: &str) -> Vec<String> {
    let mut records = Vec::new();
    let mut current: Option<String> = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.contains("ItemInfo(") {
            if let Some(prev) = current.take() {
                records.push(prev);
            }
            if trimmed.ends_with(')') {
                records.push(trimmed.to_owned());
            } else {
                current = Some(trimmed.to_owned());
            }
            continue;
        }
        if let Some(buf) = current.as_mut() {
            buf.push(' ');
            buf.push_str(trimmed);
            if trimmed.ends_with(')')
                && (trimmed.contains("title=")
                    || trimmed.contains("appWidgetId=")
                    || trimmed.contains("labelState="))
            {
                records.push(current.take().unwrap());
            }
        } else {
            records.push(trimmed.to_owned());
        }
    }
    if let Some(tail) = current {
        records.push(tail);
    }
    records
}

pub fn parse_dumpsys_launcher(raw: &str) -> (u32, u32, u32, Vec<LauncherItem>) {
    let mut cols: u32 = 0;
    let mut rows: u32 = 0;
    let mut hotseat: u32 = 0;
    let mut items = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    let mut current_folder_id: Option<String> = None;

    for line in coalesce_launcher_records(raw) {
        let trimmed = line.trim();
        if let Some(v) = extract_attr(trimmed, "numColumns")
            .and_then(|s| s.parse::<u32>().ok())
            .or_else(|| extract_colon_u32(trimmed, "inv.numColumns"))
            && v > 0
        {
            cols = cols.max(v);
        }
        if let Some(v) = extract_attr(trimmed, "numRows")
            .and_then(|s| s.parse::<u32>().ok())
            .or_else(|| extract_colon_u32(trimmed, "inv.numRows"))
            && v > 0
        {
            rows = rows.max(v);
        }
        for key in ["numShownHotseatIcons", "numDatabaseHotseatIcons"] {
            if let Some(v) = extract_attr(trimmed, key).and_then(|s| s.parse::<u32>().ok())
                && v > 0
            {
                hotseat = hotseat.max(v);
            }
        }
        if let Some(v) = extract_colon_u32(trimmed, "mHotSeatItemsCount")
            && v > 0
        {
            hotseat = hotseat.max(v);
        }

        let item_type = if trimmed.contains("LauncherAppWidgetInfo")
            || trimmed.contains("type=WIDGET")
            || trimmed.contains("providerName=")
        {
            "widget"
        } else if trimmed.contains("FolderInfo")
            || trimmed.contains("type=FOLDER")
            || (trimmed.contains("targetComponent=null") && trimmed.contains("labelState="))
        {
            "folder"
        } else if trimmed.contains("WorkspaceItemInfo")
            || trimmed.contains("ShortcutInfo")
            || trimmed.contains("AppInfo")
            || trimmed.contains("ItemInfo(")
        {
            "app"
        } else {
            continue;
        };

        let Some(id) = extract_attr(trimmed, "id") else {
            continue;
        };
        if id == "-1"
            || trimmed.contains("predicted_hotseat_container")
            || trimmed.contains("prediction_container")
        {
            continue;
        }
        let screen = extract_attr(trimmed, "screen")
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(0);
        if screen < 0 {
            continue;
        }

        let (container, folder_id) = if trimmed.contains("hotseat {") {
            current_folder_id = None;
            ("hotseat", None)
        } else if trimmed.contains("folder {") {
            let fid = current_folder_id.clone();
            ("folder", fid)
        } else if trimmed.contains("workspace {") {
            if item_type == "folder" {
                current_folder_id = Some(id.clone());
            } else {
                current_folder_id = None;
            }
            ("workspace", None)
        } else if trimmed.contains("container=#") && current_folder_id.is_some() {
            ("folder", current_folder_id.clone())
        } else {
            current_folder_id = None;
            let container_num = extract_attr(trimmed, "container")
                .and_then(|v| v.parse::<i32>().ok())
                .unwrap_or(-100);
            classify_container(container_num)
        };
        let rank = extract_attr(trimmed, "rank")
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(0);

        let (cell_x, cell_y) = extract_pair(trimmed, "cell").unwrap_or_else(|| {
            (
                extract_attr(trimmed, "cellX")
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0),
                extract_attr(trimmed, "cellY")
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0),
            )
        });
        let (span_x, span_y) = extract_pair(trimmed, "span").unwrap_or_else(|| {
            (
                extract_attr(trimmed, "spanX")
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(1),
                extract_attr(trimmed, "spanY")
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(1),
            )
        });
        let title = extract_title_value(trimmed);
        let component = extract_attr(trimmed, "targetComponent")
            .and_then(|v| extract_component_value(&v))
            .or_else(|| {
                extract_attr(trimmed, "component").and_then(|v| extract_component_value(&v))
            })
            .or_else(|| {
                extract_attr(trimmed, "providerName").and_then(|v| extract_component_value(&v))
            })
            .or_else(|| {
                let cmp = component_from_intent(trimmed);
                (!cmp.is_empty()).then_some(cmp)
            })
            .unwrap_or_default();
        let package = component.split('/').next().unwrap_or("").trim().to_owned();

        if !seen.insert((container.to_owned(), id.clone())) {
            continue;
        }

        items.push(LauncherItem {
            id,
            container: container.to_owned(),
            folder_id,
            screen,
            cell_x,
            cell_y,
            span_x: span_x.max(1),
            span_y: span_y.max(1),
            rank,
            item_type: item_type.to_owned(),
            title,
            package,
            component,
        });
    }

    (cols, rows, hotseat, items)
}

fn parse_kv_segment(row: &str, key: &str) -> String {
    let needle = format!("{key}=");
    let Some(pos) = row.find(&needle) else {
        return String::new();
    };
    let rest = &row[pos + needle.len()..];
    let mut end = rest.len();
    for marker in [
        ", title=",
        ", intent=",
        ", container=",
        ", screen=",
        ", cellX=",
        ", cellY=",
        ", spanX=",
        ", spanY=",
        ", itemType=",
        ", appWidgetProvider=",
        ", profileId=",
        ", modified=",
        ", restored=",
    ] {
        if let Some(idx) = rest.find(marker) {
            end = end.min(idx);
        }
    }
    let val = rest[..end].trim();
    if val == "NULL" {
        String::new()
    } else {
        val.to_owned()
    }
}

pub fn parse_content_favorites(raw: &str) -> Vec<LauncherItem> {
    let mut items = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("Row:") {
            continue;
        }
        let id = parse_kv_segment(trimmed, "_id");
        if id.is_empty() {
            continue;
        }
        let container_num = parse_kv_segment(trimmed, "container")
            .parse::<i32>()
            .unwrap_or(-100);
        let (container, folder_id) = classify_container(container_num);
        let item_type_num = parse_kv_segment(trimmed, "itemType").parse::<i32>().ok();
        let item_type = match item_type_num {
            Some(2) => "folder",
            Some(4) | Some(5) => "widget",
            _ => "app",
        };
        let intent = parse_kv_segment(trimmed, "intent");
        let provider = parse_kv_segment(trimmed, "appWidgetProvider");
        let component = if !provider.is_empty() {
            provider
        } else {
            component_from_intent(&intent)
        };
        let package = component.split('/').next().unwrap_or("").trim().to_owned();
        items.push(LauncherItem {
            id,
            container: container.to_owned(),
            folder_id,
            screen: parse_kv_segment(trimmed, "screen").parse().unwrap_or(0),
            cell_x: parse_kv_segment(trimmed, "cellX").parse().unwrap_or(0),
            cell_y: parse_kv_segment(trimmed, "cellY").parse().unwrap_or(0),
            span_x: parse_kv_segment(trimmed, "spanX")
                .parse::<i32>()
                .unwrap_or(1)
                .max(1),
            span_y: parse_kv_segment(trimmed, "spanY")
                .parse::<i32>()
                .unwrap_or(1)
                .max(1),
            rank: 0,
            item_type: item_type.to_owned(),
            title: parse_kv_segment(trimmed, "title"),
            package,
            component,
        });
    }
    items
}

fn infer_grid_dimensions(
    items: &[LauncherItem],
    cols: u32,
    rows: u32,
    hotseat: u32,
) -> (u32, u32, u32) {
    let max_x = items
        .iter()
        .filter(|i| i.container == "workspace")
        .map(|i| (i.cell_x + i.span_x).max(0) as u32)
        .max()
        .unwrap_or(0);
    let max_y = items
        .iter()
        .filter(|i| i.container == "workspace")
        .map(|i| (i.cell_y + i.span_y).max(0) as u32)
        .max()
        .unwrap_or(0);
    let max_hotseat = items
        .iter()
        .filter(|i| i.container == "hotseat")
        .map(|i| (i.cell_x + 1).max(0) as u32)
        .max()
        .unwrap_or(0);
    let final_cols = if cols > 0 { cols } else { max_x.max(4) };
    let final_rows = if rows > 0 { rows } else { max_y.max(5) };
    let final_hotseat = if hotseat > 0 {
        hotseat
    } else {
        max_hotseat.max(4)
    };
    (final_cols, final_rows, final_hotseat)
}

pub async fn collect_launcher_layout(adb: &Path, serial: &str) -> LauncherLayout {
    let shortcut_out = run_adb(
        adb,
        &[
            "-s",
            serial,
            "shell",
            "cmd",
            "shortcut",
            "get-default-launcher",
        ],
    )
    .await
    .unwrap_or_default();
    let resolve_out = run_adb(
        adb,
        &[
            "-s",
            serial,
            "shell",
            "cmd",
            "package",
            "resolve-activity",
            "--brief",
            "-c",
            "android.intent.category.HOME",
            "-a",
            "android.intent.action.MAIN",
        ],
    )
    .await
    .unwrap_or_default();
    let (default_launcher, launcher_package) = parse_default_launcher(&shortcut_out, &resolve_out);

    let size_raw = run_adb(adb, &["-s", serial, "shell", "wm", "size"])
        .await
        .unwrap_or_default();
    let density_raw = run_adb(adb, &["-s", serial, "shell", "wm", "density"])
        .await
        .unwrap_or_default();
    let display_size = parse_wm_size(&size_raw);
    let display_density = parse_wm_density(&density_raw);

    let mut notes = Vec::new();
    let mut source = String::new();
    let mut cols = 0;
    let mut rows = 0;
    let mut hotseat = 0;
    let mut items = Vec::new();

    if !default_launcher.is_empty()
        && let Ok(dump) = run_adb(
            adb,
            &[
                "-s",
                serial,
                "shell",
                "dumpsys",
                "activity",
                &default_launcher,
            ],
        )
        .await
    {
        let parsed = parse_dumpsys_launcher(&dump);
        cols = parsed.0;
        rows = parsed.1;
        hotseat = parsed.2;
        if !parsed.3.is_empty() {
            items = parsed.3;
            source = format!("dumpsys activity {default_launcher}");
        }
    }

    if items.is_empty()
        && let Ok(dump_top) =
            run_adb(adb, &["-s", serial, "shell", "dumpsys", "activity", "top"]).await
    {
        let parsed = parse_dumpsys_launcher(&dump_top);
        cols = cols.max(parsed.0);
        rows = rows.max(parsed.1);
        hotseat = hotseat.max(parsed.2);
        if !parsed.3.is_empty() {
            items = parsed.3;
            source = "dumpsys activity top".to_owned();
        }
    }

    if items.is_empty() {
        let mut uris = Vec::new();
        if !launcher_package.is_empty() {
            uris.push(format!("content://{launcher_package}.settings/favorites"));
        }
        if launcher_package != "com.android.launcher3" {
            uris.push("content://com.android.launcher3.settings/favorites".to_owned());
        }
        for uri in uris {
            if let Ok(raw) = run_adb(
                adb,
                &["-s", serial, "shell", "content", "query", "--uri", &uri],
            )
            .await
            {
                let parsed = parse_content_favorites(&raw);
                if !parsed.is_empty() {
                    items = parsed;
                    source = uri;
                    break;
                }
            }
        }
    }

    if items.is_empty() {
        notes.push(
            "No launcher items were exposed by dumpsys or favorites provider on this build."
                .to_owned(),
        );
        if source.is_empty() {
            source = if default_launcher.is_empty() {
                "unavailable".to_owned()
            } else {
                format!("dumpsys ({default_launcher})")
            };
        }
    }

    let (grid_columns, grid_rows, hotseat_count) =
        infer_grid_dimensions(&items, cols, rows, hotseat);

    LauncherLayout {
        collected_at: chrono::Local::now().to_rfc3339(),
        default_launcher,
        launcher_package,
        display_size,
        display_density,
        grid_columns,
        grid_rows,
        hotseat_count,
        source,
        items,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_launcher_and_display_metrics() {
        let (cmp, pkg) = parse_default_launcher(
            "Launcher: ComponentInfo{com.android.launcher3/.Launcher}",
            "",
        );
        assert_eq!(cmp, "com.android.launcher3/.Launcher");
        assert_eq!(pkg, "com.android.launcher3");

        let (cmp2, pkg2) = parse_default_launcher(
            "",
            "priority=0 preferredOrder=0\ncom.unisoc.launcher/com.android.launcher3.uioverrides.QuickstepLauncher",
        );
        assert_eq!(
            cmp2,
            "com.unisoc.launcher/com.android.launcher3.uioverrides.QuickstepLauncher"
        );
        assert_eq!(pkg2, "com.unisoc.launcher");

        assert_eq!(
            parse_wm_size("Physical size: 720x1600\nOverride size: 1080x2400"),
            "1080x2400"
        );
        assert_eq!(parse_wm_density("Physical density: 320"), "320");
    }

    #[test]
    fn parses_dumpsys_launcher_grid_and_items() {
        let dump = r#"
          InvariantDeviceProfile: numColumns=4 numRows=5 numShownHotseatIcons=4
          WorkspaceItemInfo(id=12 type=APPLICATION container=-100 screen=0 cell(1,2) span(1,1) title=Chrome component=com.android.chrome/com.google.android.apps.chrome.Main)
          AppInfo(id=13 type=APPLICATION container=-101 screen=0 cell(0,0) span(1,1) title=Phone component=com.android.dialer/.DialtactsActivity)
          FolderInfo(id=20 type=FOLDER container=-100 screen=0 cell(3,4) span(1,1) title=Google)
          WorkspaceItemInfo(id=21 type=APPLICATION container=20 screen=0 cell(0,0) span(1,1) title=Maps component=com.google.android.apps.maps/com.google.android.maps.MapsActivity)
          LauncherAppWidgetInfo(id=30 appWidgetId=7 container=-100 screen=1 cell(0,0) span(4,2) providerName=com.google.android.googlequicksearchbox/.SearchWidgetProvider)
        "#;
        let (cols, rows, hotseat, items) = parse_dumpsys_launcher(dump);
        assert_eq!((cols, rows, hotseat), (4, 5, 4));
        assert_eq!(items.len(), 5);
        assert_eq!(items[0].container, "workspace");
        assert_eq!(items[0].package, "com.android.chrome");
        assert_eq!(items[1].container, "hotseat");
        assert_eq!(items[2].item_type, "folder");
        assert_eq!(items[3].container, "folder");
        assert_eq!(items[3].folder_id.as_deref(), Some("20"));
        assert_eq!(items[4].item_type, "widget");
        assert_eq!((items[4].span_x, items[4].span_y), (4, 2));
    }

    #[test]
    fn parses_content_favorites_rows() {
        let raw = "Row: 0 _id=5, title=Camera, intent=#Intent;component=com.android.camera2/com.android.camera.CameraLauncher;end, container=-100, screen=0, cellX=2, cellY=3, spanX=1, spanY=1, itemType=0";
        let items = parse_content_favorites(raw);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Camera");
        assert_eq!(items[0].package, "com.android.camera2");
        assert_eq!((items[0].cell_x, items[0].cell_y), (2, 3));
    }

    #[test]
    fn parses_multiline_android15_launcher3_dumpsys() {
        let dump = r#"
          DeviceProfile:
            inv.numRows: 6
            inv.numColumns: 4
          mHotSeatItemsCount: 4
          ItemInfo(id=5 type=WIDGET container=# com.android.launcher3.logger.LauncherAtom$ContainerInfo@1
          workspace {
            page_index: 0
          } targetComponent=ComponentInfo{com.fuui.sys.widgets/.WeatherWidgetProvider} screen=0 cell(0,0) span(4,2) minSpan(4,2) rank=0 user=UserHandle{0} title=null providerName=ComponentInfo{com.fuui.sys.widgets/.WeatherWidgetProvider} appWidgetId=3)
          ItemInfo(id=10 type=APP container=# com.android.launcher3.logger.LauncherAtom$ContainerInfo@2
          hotseat {
          } targetComponent=ComponentInfo{com.android.settings/.Settings} screen=0 cell(3,5) span(1,1) rank=0 user=UserHandle{0} title=Settings supportsMultiInstance=false)
          ItemInfo(id=24 type=APP container=# com.android.launcher3.logger.LauncherAtom$ContainerInfo@4
          workspace {
            page_index: 1
          } targetComponent=null screen=1 cell(2,0) span(2,2) rank=0 user=UserHandle{0} title=Tools; labelState=SUGGESTED)
          ItemInfo(id=25 type=APP container=# com.android.launcher3.logger.LauncherAtom$ContainerInfo@5 targetComponent=ComponentInfo{com.android.soundrecorder/.SoundRecorder} screen=0 cell(0,0) span(1,1) rank=0 user=UserHandle{0} title=Sound Recorder supportsMultiInstance=false)
          ItemInfo(id=-1 type=APP container=# com.android.launcher3.logger.LauncherAtom$ContainerInfo@3
          predicted_hotseat_container {
          } targetComponent=ComponentInfo{com.google.android.gm/.Gmail} screen=-1 cell(-1,-1) span(1,1) rank=0 user=UserHandle{0} title=Gmail supportsMultiInstance=false)
        "#;
        let (cols, rows, hotseat, items) = parse_dumpsys_launcher(dump);
        assert_eq!((cols, rows, hotseat), (4, 6, 4));
        assert_eq!(items.len(), 4);
        assert_eq!(items[0].item_type, "widget");
        assert_eq!(items[0].package, "com.fuui.sys.widgets");
        assert_eq!((items[0].span_x, items[0].span_y), (4, 2));
        assert_eq!(items[1].container, "hotseat");
        assert_eq!(items[1].title, "Settings");
        assert_eq!(items[2].item_type, "folder");
        assert_eq!(items[2].title, "Tools");
        assert_eq!(items[3].container, "folder");
        assert_eq!(items[3].folder_id.as_deref(), Some("24"));
        assert_eq!(items[3].rank, 0);
    }
}
