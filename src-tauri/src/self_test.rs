use std::collections::BTreeMap;

use std::time::Duration;

use crate::review::{self, Artifacts, ReviewLedger};

mod adb;
mod collector;
mod diff;
mod exporter;
mod hardware;
mod launcher;
mod storage;
pub use adb::*;
pub use collector::*;
pub use diff::*;
pub use exporter::*;
pub use hardware::*;
pub use launcher::*;
pub use storage::*;

const ADB_TIMEOUT_SECS: u64 = 20;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SelfTestError {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl SelfTestError {
    pub fn new(code: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: None,
        }
    }

    pub fn with_message(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: Some(message.into()),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AdbDevice {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub product: String,
    pub device: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SelfTestEnv {
    pub adb_found: bool,
    pub adb_path: String,
    pub adb_version: String,
    pub devices: Vec<AdbDevice>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DrmSection {
    pub name: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SelfTestCheck {
    pub level: String,
    pub code: String,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SelfTestRecord {
    pub id: String,
    pub collected_at: String,
    #[serde(default)]
    pub name: String,
    pub serial: String,
    pub adb_path: String,
    pub adb_version: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub test_type: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub model_code: String,
    #[serde(default)]
    pub ota_version: String,
    #[serde(default = "default_verdict")]
    pub verdict: String,
    #[serde(default)]
    pub baseline_id: String,
    #[serde(default = "default_patch_reference")]
    pub patch_reference: String,
    #[serde(default = "default_patch_valid_days")]
    pub patch_valid_days: u32,
    #[serde(default)]
    pub checks: Vec<SelfTestCheck>,
    pub fields: BTreeMap<String, String>,
    pub drm_facts: Vec<String>,
    pub drm_sections: Vec<DrmSection>,
    pub packages: Vec<String>,
    pub features: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launcher_layout: Option<LauncherLayout>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hardware: Option<HardwareSnapshot>,
    #[serde(default)]
    pub review: ReviewLedger,
    #[serde(default)]
    pub artifacts: Artifacts,
}

fn default_verdict() -> String {
    "pending".to_owned()
}

fn default_patch_reference() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn default_patch_valid_days() -> u32 {
    crate::checks::DEFAULT_PATCH_VALID_DAYS
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct StoredSelfTestRecord {
    pub id: String,
    pub collected_at: String,
    #[serde(default)]
    pub name: String,
    pub serial: String,
    pub adb_path: String,
    pub adb_version: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub test_type: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub model_code: String,
    #[serde(default)]
    pub ota_version: String,
    #[serde(default = "default_verdict")]
    pub verdict: String,
    #[serde(default)]
    pub baseline_id: String,
    #[serde(default = "default_patch_reference")]
    pub patch_reference: String,
    #[serde(default = "default_patch_valid_days")]
    pub patch_valid_days: u32,
    #[serde(default)]
    pub checks: Vec<SelfTestCheck>,
    pub fields: BTreeMap<String, String>,
    pub drm_facts: Vec<String>,
    pub drm_sections: Vec<DrmSection>,
    #[serde(default)]
    pub packages_hash: Option<String>,
    #[serde(default)]
    pub features_hash: Option<String>,
    #[serde(default)]
    pub packages: Vec<String>,
    #[serde(default)]
    pub features: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launcher_layout: Option<LauncherLayout>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hardware: Option<HardwareSnapshot>,
    #[serde(default)]
    pub review: ReviewLedger,
    #[serde(default)]
    pub artifacts: Artifacts,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SelfTestSummary {
    pub id: String,
    pub collected_at: String,
    #[serde(default)]
    pub name: String,
    pub serial: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub test_type: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub model_code: String,
    #[serde(default)]
    pub ota_version: String,
    #[serde(default = "default_verdict")]
    pub verdict: String,
    #[serde(default)]
    pub check_status: String,
    #[serde(default)]
    pub check_errors: usize,
    #[serde(default)]
    pub check_warnings: usize,
    #[serde(default)]
    pub baseline_id: String,
    #[serde(default)]
    pub patch_reference: String,
    #[serde(default = "default_patch_valid_days")]
    pub patch_valid_days: u32,
    pub model: String,
    pub build: String,
    pub android: String,
    pub gms: String,
    pub patch: String,
    pub package_count: usize,
    pub feature_count: usize,
    #[serde(default)]
    pub review_status: String,
    #[serde(default)]
    pub review_pending: usize,
    #[serde(default)]
    pub reviewer: String,
    #[serde(default)]
    pub reviewed_at: String,
    #[serde(default)]
    pub vendor_boot_debug: String,
    #[serde(default)]
    pub soc_vendor: String,
    #[serde(default)]
    pub soc_model: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SelfTestFieldDiff {
    pub key: String,
    pub left: String,
    pub right: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SelfTestDiff {
    pub left_id: String,
    pub right_id: String,
    pub field_changes: Vec<SelfTestFieldDiff>,
    pub key_fields: Vec<SelfTestFieldDiff>,
    pub drm_facts_added: Vec<String>,
    pub drm_facts_removed: Vec<String>,
    pub packages_added: Vec<String>,
    pub packages_removed: Vec<String>,
    pub packages_unchanged: usize,
    pub packages_same: Vec<String>,
    pub features_added: Vec<String>,
    pub features_removed: Vec<String>,
    pub features_unchanged: usize,
    pub features_same: Vec<String>,
}

#[tauri::command]
pub async fn self_test_env(adb_path: Option<String>) -> SelfTestEnv {
    let Some(adb) = resolve_adb_path(adb_path.as_deref()) else {
        return SelfTestEnv {
            adb_found: false,
            adb_path: String::new(),
            adb_version: String::new(),
            devices: Vec::new(),
            error: Some("adb not found".to_owned()),
        };
    };

    let adb_str = adb.to_string_lossy().into_owned();
    let version = match run_adb(&adb, &["version"]).await {
        Ok(out) => out.lines().next().unwrap_or("").trim().to_owned(),
        Err(err) => {
            return SelfTestEnv {
                adb_found: false,
                adb_path: adb_str,
                adb_version: String::new(),
                devices: Vec::new(),
                error: Some(err),
            };
        }
    };

    match run_adb(&adb, &["devices", "-l"]).await {
        Ok(out) => SelfTestEnv {
            adb_found: true,
            adb_path: adb_str,
            adb_version: version,
            devices: parse_adb_devices(&out),
            error: None,
        },
        Err(err) => SelfTestEnv {
            adb_found: true,
            adb_path: adb_str,
            adb_version: version,
            devices: Vec::new(),
            error: Some(err),
        },
    }
}

fn load_record_raw(id: &str) -> Result<SelfTestRecord, SelfTestError> {
    let clean = sanitize_id(id).ok_or_else(|| SelfTestError::new("invalid_id"))?;
    let path = records_dir()?.join(format!("{clean}.json"));
    let bytes = std::fs::read(&path).map_err(|_| SelfTestError::new("record_missing"))?;
    let stored = serde_json::from_slice::<StoredSelfTestRecord>(&bytes)
        .map_err(|_| SelfTestError::new("record_missing"))?;
    let packages = match &stored.packages_hash {
        Some(hash) => read_blob(hash).unwrap_or(stored.packages),
        None => stored.packages,
    };
    let features = match &stored.features_hash {
        Some(hash) => read_blob(hash).unwrap_or(stored.features),
        None => stored.features,
    };
    Ok(SelfTestRecord {
        id: stored.id,
        collected_at: stored.collected_at,
        name: stored.name,
        serial: stored.serial,
        adb_path: stored.adb_path,
        adb_version: stored.adb_version,
        note: stored.note,
        test_type: stored.test_type,
        tags: stored.tags,
        model_code: stored.model_code,
        ota_version: stored.ota_version,
        verdict: stored.verdict,
        baseline_id: stored.baseline_id,
        patch_reference: stored.patch_reference,
        patch_valid_days: stored.patch_valid_days,
        checks: stored.checks,
        fields: stored.fields,
        drm_facts: stored.drm_facts,
        drm_sections: stored.drm_sections,
        packages,
        features,
        launcher_layout: stored.launcher_layout,
        hardware: stored.hardware,
        review: stored.review,
        artifacts: stored.artifacts,
    })
}

fn recompute_checks(record: &mut SelfTestRecord, index: &[SelfTestSummary]) {
    normalize_record(record);
    let baseline = baseline_for(record, index);
    if record.baseline_id.trim().is_empty()
        && let Some(base) = &baseline
    {
        record.baseline_id = base.id.clone();
    }
    record.checks = crate::checks::evaluate(record, baseline.as_ref());
}

fn record_with_checks(mut record: SelfTestRecord) -> SelfTestRecord {
    normalize_record(&mut record);
    if record.checks.is_empty()
        && let Ok(index) = read_index()
    {
        recompute_checks(&mut record, &index);
    }
    record
}

#[tauri::command]
pub async fn self_test_adb_restart(adb_path: Option<String>) -> SelfTestEnv {
    let Some(adb) = resolve_adb_path(adb_path.as_deref()) else {
        return SelfTestEnv {
            adb_found: false,
            adb_path: String::new(),
            adb_version: String::new(),
            devices: Vec::new(),
            error: Some("adb not found".to_owned()),
        };
    };
    let _ = run_adb(&adb, &["kill-server"]).await;
    let _ = run_adb(&adb, &["start-server"]).await;
    self_test_env(adb_path).await
}

#[tauri::command]
pub async fn self_test_wait_device(
    adb_path: Option<String>,
    serial: String,
    timeout_secs: Option<u64>,
) -> Result<SelfTestEnv, SelfTestError> {
    let serial = serial.trim().to_owned();
    if serial.is_empty() {
        return Err(SelfTestError::new("invalid_id"));
    }
    let adb =
        resolve_adb_path(adb_path.as_deref()).ok_or_else(|| SelfTestError::new("adb_missing"))?;
    let timeout = timeout_secs.unwrap_or(30).clamp(1, 600);
    let deadline = std::time::Instant::now() + Duration::from_secs(timeout);
    loop {
        if let Ok(raw) = run_adb(&adb, &["devices", "-l"]).await {
            let ready = parse_adb_devices(&raw)
                .into_iter()
                .any(|device| device.serial == serial && device.state == "device");
            if ready {
                return Ok(self_test_env(adb_path).await);
            }
        }
        if std::time::Instant::now() >= deadline {
            return Err(SelfTestError::new("device_timeout"));
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn self_test_run(
    adb_path: Option<String>,
    serial: String,
    note: Option<String>,
    name: Option<String>,
    test_type: Option<String>,
    tags: Option<Vec<String>>,
    model_code: Option<String>,
    ota_version: Option<String>,
    patch_reference: Option<String>,
    patch_valid_days: Option<u32>,
) -> Result<SelfTestRecord, SelfTestError> {
    let serial = serial.trim().to_owned();
    if serial.is_empty() {
        return Err(SelfTestError::new("collect_failed"));
    }
    let adb =
        resolve_adb_path(adb_path.as_deref()).ok_or_else(|| SelfTestError::new("adb_missing"))?;
    let adb_version = run_adb(&adb, &["version"])
        .await
        .unwrap_or_default()
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_owned();

    let getprop_raw = run_adb(&adb, &["-s", &serial, "shell", "getprop"])
        .await
        .map_err(|message| SelfTestError::with_message("adb_failed", message))?;
    let prop_map = parse_getprop_map(&getprop_raw);
    if prop_map.is_empty() {
        return Err(SelfTestError::new("collect_failed"));
    }
    let fields = extract_key_fields(&prop_map);

    let pkg_raw = run_adb(&adb, &["-s", &serial, "shell", "pm", "list", "package"])
        .await
        .unwrap_or_default();
    let packages = clean_list_lines(&pkg_raw, "package:");

    let feat_raw = run_adb(&adb, &["-s", &serial, "shell", "pm", "list", "features"])
        .await
        .unwrap_or_default();
    let features = clean_list_lines(&feat_raw, "feature:");

    let mut drm_sections = Vec::new();
    let drm_props = getprop_raw
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && is_drm_line(l))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if !drm_props.is_empty() {
        drm_sections.push(DrmSection {
            name: "properties".to_owned(),
            lines: drm_props,
        });
    }

    let drm_features = features
        .iter()
        .filter(|f| f.to_ascii_lowercase().contains("drm"))
        .cloned()
        .collect::<Vec<_>>();
    if !drm_features.is_empty() {
        drm_sections.push(DrmSection {
            name: "features".to_owned(),
            lines: drm_features,
        });
    }

    let mut drm_facts = Vec::new();
    if let Ok(svc_raw) = run_adb(&adb, &["-s", &serial, "shell", "service", "list"]).await {
        let drm_svcs = svc_raw
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && is_drm_line(l))
            .map(str::to_owned)
            .collect::<Vec<_>>();
        if !drm_svcs.is_empty() {
            drm_sections.push(DrmSection {
                name: "services".to_owned(),
                lines: drm_svcs,
            });
        }
    }

    if let Ok(dumpsys_raw) = run_adb(&adb, &["-s", &serial, "shell", "dumpsys", "media.drm"]).await
    {
        let lines = dumpsys_raw
            .lines()
            .map(str::trim_end)
            .filter(|l| !l.trim().is_empty())
            .take(120)
            .map(str::to_owned)
            .collect::<Vec<_>>();
        for line in &lines {
            let trimmed = line.trim();
            if (trimmed.contains("securityLevel")
                || trimmed.contains("SecurityLevel")
                || trimmed.contains("hdcpLevel")
                || trimmed.contains("vendor")
                || trimmed.contains("version"))
                && drm_facts.len() < 8
            {
                drm_facts.push(trimmed.to_owned());
            }
        }
        if !lines.is_empty() {
            drm_sections.push(DrmSection {
                name: "dumpsys media.drm".to_owned(),
                lines,
            });
        }
    }

    if let Ok(lib_raw) = run_adb(&adb, &["-s", &serial, "shell", "pm", "list", "libraries"]).await {
        let drm_libs = lib_raw
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && is_drm_line(l))
            .map(str::to_owned)
            .collect::<Vec<_>>();
        if !drm_libs.is_empty() {
            drm_sections.push(DrmSection {
                name: "libraries".to_owned(),
                lines: drm_libs,
            });
        }
    }

    let launcher_layout = Some(collect_launcher_layout(&adb, &serial).await);
    let hardware = Some(collect_hardware(&adb, &serial, &prop_map).await);

    let now = chrono::Local::now();
    let id = now.format("%Y%m%d-%H%M%S-%3f").to_string();
    let collected_at = now.to_rfc3339();
    let mut record = SelfTestRecord {
        id: id.clone(),
        collected_at,
        name: String::new(),
        serial,
        adb_path: adb.to_string_lossy().into_owned(),
        adb_version,
        note: note.unwrap_or_default().trim().to_owned(),
        test_type: normalize_test_type(&test_type.unwrap_or_default()),
        tags: normalize_tags(&tags.unwrap_or_default()),
        model_code: model_code.unwrap_or_default().trim().to_owned(),
        ota_version: ota_version.unwrap_or_default().trim().to_uppercase(),
        verdict: default_verdict(),
        baseline_id: String::new(),
        patch_reference: patch_reference
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| now.format("%Y-%m-%d").to_string()),
        patch_valid_days: patch_valid_days
            .filter(|days| *days > 0)
            .unwrap_or(crate::checks::DEFAULT_PATCH_VALID_DAYS),
        checks: Vec::new(),
        fields,
        drm_facts,
        drm_sections,
        packages,
        features,
        launcher_layout,
        hardware,
        review: ReviewLedger::default(),
        artifacts: Artifacts::default(),
    };

    let mut index = read_index()?;
    recompute_checks(&mut record, &index);
    let wanted = name
        .map(|value| sanitize_name(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default_name(&record));
    record.name = unique_name(&index, &wanted, &record.id);
    save_record_internal(&record)?;
    index.insert(0, summary_of(&record));
    write_index(&index)?;
    Ok(record)
}

#[tauri::command]
pub async fn self_test_launcher_layout(
    adb_path: Option<String>,
    serial: String,
) -> Result<LauncherLayout, SelfTestError> {
    let serial = serial.trim().to_owned();
    if serial.is_empty() {
        return Err(SelfTestError::new("collect_failed"));
    }
    let adb =
        resolve_adb_path(adb_path.as_deref()).ok_or_else(|| SelfTestError::new("adb_missing"))?;
    Ok(collect_launcher_layout(&adb, &serial).await)
}

#[tauri::command]
pub fn self_test_list() -> Result<Vec<SelfTestSummary>, SelfTestError> {
    let mut items = read_index()?;
    let snapshot = items.clone();
    for item in &mut items {
        let Ok(record) = load_record_raw(&item.id) else {
            continue;
        };
        let record = record_with_checks(record);
        let plan = review_plan_for(&record, None, &snapshot);
        let status = review::status_of(&plan);
        item.review_status = status.state;
        item.review_pending = status.pending;
        item.reviewer = record.review.reviewer.clone();
        item.reviewed_at = record.review.updated_at.clone();
        item.vendor_boot_debug = record.artifacts.vendor_boot_debug.path.clone();
        item.soc_vendor = record.fields.get("soc_vendor").cloned().unwrap_or_default();
        item.soc_model = record.fields.get("soc_model").cloned().unwrap_or_default();
    }
    Ok(items)
}

fn merge_review_summary(
    summary: &mut SelfTestSummary,
    record: &SelfTestRecord,
    plan: &review::ReviewPlan,
) {
    summary.review_status = review::status_of(plan).state;
    summary.review_pending = plan.counts.pending;
    summary.reviewer = record.review.reviewer.clone();
    summary.reviewed_at = record.review.updated_at.clone();
    summary.vendor_boot_debug = record.artifacts.vendor_boot_debug.path.clone();
}

#[tauri::command]
pub fn self_test_review_plan(
    id: String,
    baseline_id: Option<String>,
) -> Result<review::ReviewPlan, SelfTestError> {
    let record = record_with_checks(load_record_raw(&id)?);
    let index = read_index()?;
    Ok(review_plan_for(&record, baseline_id.as_deref(), &index))
}

#[tauri::command]
pub fn self_test_review_status(
    ids: Vec<String>,
) -> Result<Vec<review::ReviewStatusSummary>, SelfTestError> {
    let index = read_index()?;
    let mut out = Vec::new();
    for id in ids {
        let Ok(record) = load_record_raw(&id) else {
            continue;
        };
        let record = record_with_checks(record);
        let plan = review_plan_for(&record, None, &index);
        out.push(review::status_of(&plan));
    }
    Ok(out)
}

#[tauri::command]
pub fn self_test_review_save(
    id: String,
    baseline_id: Option<String>,
    fingerprint: String,
    reviewer: Option<String>,
    decisions: BTreeMap<String, review::ReviewDecision>,
    artifacts: Artifacts,
) -> Result<SelfTestRecord, SelfTestError> {
    let mut record = record_with_checks(load_record_raw(&id)?);
    record.artifacts = review::normalize_artifacts(artifacts);
    let index = read_index()?;
    let plan = review_plan_for(&record, baseline_id.as_deref(), &index);
    let ledger = review::validate_and_build_ledger(
        &plan,
        &fingerprint,
        reviewer.as_deref().unwrap_or_default(),
        &decisions,
    )
    .map_err(SelfTestError::new)?;
    record.artifacts.vendor_boot_debug.checked =
        !record.artifacts.vendor_boot_debug.path.is_empty()
            && ledger
                .decisions
                .get("artifact:vendor_boot_debug")
                .is_some_and(|decision| decision.state == "confirmed");
    record.review = ledger;
    save_record_internal(&record)?;

    let current_plan = review_plan_for(&record, baseline_id.as_deref(), &index);
    let mut summary = summary_of(&record);
    merge_review_summary(&mut summary, &record, &current_plan);
    let mut items = index;
    if let Some(slot) = items.iter_mut().find(|item| item.id == record.id) {
        *slot = summary;
    } else {
        items.insert(0, summary);
    }
    write_index(&items)?;
    Ok(record)
}

#[tauri::command]
pub fn self_test_get(id: String) -> Result<SelfTestRecord, SelfTestError> {
    Ok(record_with_checks(load_record_raw(&id)?))
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn self_test_update_meta(
    id: String,
    note: String,
    name: String,
    test_type: String,
    tags: Vec<String>,
    model_code: String,
    ota_version: String,
    verdict: String,
    patch_reference: String,
    patch_valid_days: u32,
    baseline_id: Option<String>,
) -> Result<SelfTestRecord, SelfTestError> {
    let mut rec = record_with_checks(load_record_raw(&id)?);
    rec.note = note.trim().to_owned();
    rec.model_code = model_code.trim().to_owned();
    rec.ota_version = ota_version.trim().to_uppercase();
    rec.test_type = normalize_test_type(&test_type);
    rec.tags = normalize_tags(&tags);
    rec.verdict = match verdict.trim() {
        "pass" | "fail" | "pending" => verdict.trim().to_owned(),
        _ => "pending".to_owned(),
    };
    if !patch_reference.trim().is_empty() {
        rec.patch_reference = patch_reference.trim().to_owned();
    }
    if patch_valid_days > 0 {
        rec.patch_valid_days = patch_valid_days;
    }
    if let Some(baseline) = baseline_id {
        rec.baseline_id = baseline.trim().to_owned();
    }

    let mut index = read_index()?;
    let wanted = if name.trim().is_empty() {
        default_name(&rec)
    } else {
        sanitize_name(&name)
    };
    rec.name = unique_name(&index, &wanted, &rec.id);
    recompute_checks(&mut rec, &index);
    save_record_internal(&rec)?;

    let summary = summary_of(&rec);
    if let Some(slot) = index.iter_mut().find(|s| s.id == rec.id) {
        *slot = summary;
    } else {
        index.insert(0, summary);
    }
    write_index(&index)?;
    Ok(rec)
}

#[tauri::command]
pub fn self_test_rename(id: String, name: String) -> Result<SelfTestRecord, SelfTestError> {
    let mut rec = record_with_checks(load_record_raw(&id)?);
    let mut index = read_index()?;
    let wanted = if name.trim().is_empty() {
        default_name(&rec)
    } else {
        sanitize_name(&name)
    };
    rec.name = unique_name(&index, &wanted, &rec.id);
    save_record_internal(&rec)?;
    let summary = summary_of(&rec);
    if let Some(slot) = index.iter_mut().find(|s| s.id == rec.id) {
        *slot = summary;
    }
    write_index(&index)?;
    Ok(rec)
}

#[tauri::command]
pub fn self_test_recheck(
    id: String,
    baseline_id: Option<String>,
) -> Result<SelfTestRecord, SelfTestError> {
    let mut rec = record_with_checks(load_record_raw(&id)?);
    if let Some(baseline) = baseline_id {
        rec.baseline_id = baseline.trim().to_owned();
    }
    let mut index = read_index()?;
    recompute_checks(&mut rec, &index);
    save_record_internal(&rec)?;
    let summary = summary_of(&rec);
    if let Some(slot) = index.iter_mut().find(|s| s.id == rec.id) {
        *slot = summary;
    }
    write_index(&index)?;
    Ok(rec)
}

#[tauri::command]
pub fn self_test_delete(id: String) -> Result<(), SelfTestError> {
    let clean = sanitize_id(&id).ok_or_else(|| SelfTestError::new("invalid_id"))?;
    let path = records_dir()?.join(format!("{clean}.json"));
    if path.exists() {
        std::fs::remove_file(&path).map_err(|_| SelfTestError::new("io_failed"))?;
    }
    let mut index = read_index()?;
    index.retain(|s| s.id != clean);
    write_index(&index)
}

#[tauri::command]
pub fn self_test_diff(left_id: String, right_id: String) -> Result<SelfTestDiff, SelfTestError> {
    let left = self_test_get(left_id)?;
    let right = self_test_get(right_id)?;
    Ok(compute_diff(&left, &right))
}

#[tauri::command]
pub fn self_test_storage() -> Result<String, SelfTestError> {
    Ok(data_dir()?.display().to_string())
}

#[tauri::command]
pub async fn self_test_export_file(
    app: tauri::AppHandle,
    id: String,
    format: String,
    locale: Option<String>,
    encoding: Option<String>,
    xlsx_options: Option<XlsxOptions>,
) -> Result<Option<String>, SelfTestError> {
    use tauri_plugin_dialog::DialogExt;

    let zh = locale.as_deref() != Some("en");

    if format == "csv" {
        let summaries = if id == "__all__" {
            read_index()?
        } else {
            let rec = self_test_get(id)?;
            vec![summary_of(&rec)]
        };
        let (tx, rx) = tokio::sync::oneshot::channel();
        app.dialog()
            .file()
            .set_title(if zh {
                "导出设备自测台账 (CSV)"
            } else {
                "Export self-test ledger (CSV)"
            })
            .add_filter("CSV", &["csv"])
            .set_file_name("self-test-ledger.csv")
            .save_file(move |path| {
                let _ = tx.send(path);
            });
        let Some(path) = rx.await.ok().flatten().and_then(|p| p.into_path().ok()) else {
            return Ok(None);
        };
        write_utf8_bom(&path, &render_csv_ledger(&summaries))?;
        return Ok(Some(path.display().to_string()));
    }

    let rec = self_test_get(id)?;
    let base_name = format!(
        "self-test-{}-{}",
        rec.fields
            .get("model")
            .map(String::as_str)
            .unwrap_or("device")
            .replace(' ', "_"),
        rec.id
    );

    if format == "txt4" {
        let (tx, rx) = tokio::sync::oneshot::channel();
        app.dialog()
            .file()
            .set_title(if zh {
                "选择 4 件套 txt 导出目录"
            } else {
                "Choose the folder for the 4 txt files"
            })
            .pick_folder(move |path| {
                let _ = tx.send(path);
            });
        let Some(dir) = rx.await.ok().flatten().and_then(|p| p.into_path().ok()) else {
            return Ok(None);
        };
        write_txt4_bundle(&dir, &rec, encoding.as_deref().unwrap_or("bom"))?;
        return Ok(Some(dir.display().to_string()));
    }

    let xlsx_options = xlsx_options.unwrap_or_default();
    let (ext, title) = match format.as_str() {
        "xlsx" => (
            "xlsx",
            if zh {
                "导出 Excel 工作簿 (XLSX)"
            } else {
                "Export Excel workbook (XLSX)"
            },
        ),
        "json" => (
            "json",
            if zh {
                "导出结构化快照 (JSON)"
            } else {
                "Export JSON snapshot"
            },
        ),
        _ => (
            "md",
            if zh {
                "导出自测报告 (Markdown)"
            } else {
                "Export Markdown report"
            },
        ),
    };

    let file_name = if ext == "xlsx" {
        xlsx_file_name(&base_name, &rec, &xlsx_options.filename)
    } else {
        format!("{base_name}.{ext}")
    };
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title(title)
        .add_filter(ext.to_uppercase(), &[ext])
        .set_file_name(file_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let Some(path) = rx.await.ok().flatten().and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    if ext == "xlsx" {
        write_xlsx_report(&path, &rec, zh, &xlsx_options)?;
    } else {
        let content = if ext == "json" {
            serde_json::to_string_pretty(&rec).map_err(|_| SelfTestError::new("export_failed"))?
        } else {
            render_markdown_report(&rec, zh)
        };
        std::fs::write(&path, content.as_bytes())
            .map_err(|_| SelfTestError::new("export_failed"))?;
    }
    Ok(Some(path.display().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_adb_devices_list() {
        let raw = "List of devices attached\nABCDEF123\tdevice product:demo_a1 model:Demo_Phone_A1 device:demo-phone-a1 transport_id:1\nDEAD999\tunauthorized\n";
        let list = parse_adb_devices(raw);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].serial, "ABCDEF123");
        assert_eq!(list[0].state, "device");
        assert_eq!(list[0].model, "Demo Phone A1");
        assert_eq!(list[1].state, "unauthorized");
    }

    #[test]
    fn extracts_key_fields_with_fallbacks() {
        let raw = "[ro.build.version.incremental]: [DEMO-R14-001]\n[ro.build.version.release]: [15]\n[ro.boot.baseband]: [DEMO-BASEBAND]\n[ro.soc.manufacturer]: [Unisoc]\n[ro.soc.model]: [UMS9230]\n";
        let fields = extract_key_fields(&parse_getprop_map(raw));
        assert_eq!(fields["build"], "DEMO-R14-001");
        assert_eq!(fields["soc_vendor"], "Unisoc");
        assert_eq!(fields["soc_model"], "UMS9230");
        assert_eq!(fields["android"], "15");
        assert_eq!(fields["baseband"], "DEMO-BASEBAND");
        assert_eq!(fields["gms"], "(not set)");
        assert_eq!(fields["buildtype"], "(not set)");
        assert_eq!(fields["tags"], "(not set)");
        assert_eq!(fields["firstapi"], "(not set)");
    }

    #[test]
    fn extracts_build_type_tags_and_first_api() {
        let raw = "[ro.build.type]: [userdebug]\n[ro.build.tags]: [test-keys]\n[ro.product.first_api_level]: [34]\n";
        let fields = extract_key_fields(&parse_getprop_map(raw));
        assert_eq!(fields["buildtype"], "userdebug");
        assert_eq!(fields["tags"], "test-keys");
        assert_eq!(fields["firstapi"], "34");
    }

    fn sample_record() -> SelfTestRecord {
        SelfTestRecord {
            id: "20261119-120000-000".into(),
            collected_at: "2026-11-19T12:00:00+08:00".into(),
            name: "DEMO_IR_V14_20261119".into(),
            serial: "ABC123".into(),
            adb_path: "/usr/bin/adb".into(),
            adb_version: "1.0.41".into(),
            note: "pre-test".into(),
            test_type: "IR".into(),
            tags: vec!["internal".into()],
            model_code: "DEMO-A1".into(),
            ota_version: "OTA1".into(),
            verdict: "pass".into(),
            baseline_id: String::new(),
            patch_reference: "2026-11-19".into(),
            patch_valid_days: 90,
            checks: vec![],
            fields: BTreeMap::from([
                ("model".into(), "Demo Phone A1".into()),
                ("build".into(), "DEMO-R14-001".into()),
                ("gms".into(), "15_r1".into()),
                ("patch".into(), "2026-11-01".into()),
                ("firstapi".into(), "36".into()),
                ("sdk".into(), "36".into()),
                ("buildtype".into(), "user".into()),
                ("tags".into(), "release-keys".into()),
                ("baseos".into(), "(not set)".into()),
                (
                    "fingerprint".into(),
                    "brand/model:16/V14/user/release-keys".into(),
                ),
            ]),
            drm_facts: vec!["securityLevel=L1".into()],
            drm_sections: vec![DrmSection {
                name: "services".into(),
                lines: vec!["drm.drmManager".into()],
            }],
            packages: vec!["com.a".into()],
            features: vec!["android.hardware.drm".into()],
            launcher_layout: None,
            hardware: None,
            review: ReviewLedger::default(),
            artifacts: Artifacts::default(),
        }
    }

    #[test]
    fn computes_diff_between_records() {
        let left = sample_record();
        let mut right = left.clone();
        right.id = "2".into();
        right.fields.insert("gms".into(), "15_r2".into());
        right.drm_facts = vec!["securityLevel=L3".into()];
        right.packages = vec!["com.b".into(), "com.c".into()];
        right.features = vec!["f1".into(), "f2".into()];

        let diff = compute_diff(&left, &right);
        assert!(!diff.field_changes.is_empty());
        assert_eq!(diff.drm_facts_added, vec!["securityLevel=L3"]);
        assert_eq!(diff.drm_facts_removed, vec!["securityLevel=L1"]);
        assert_eq!(diff.packages_added, vec!["com.b", "com.c"]);
        assert_eq!(diff.packages_removed, vec!["com.a"]);
        assert_eq!(diff.features_added, vec!["f1", "f2"]);
        assert_eq!(diff.features_removed, vec!["android.hardware.drm"]);
    }

    #[test]
    fn localizes_markdown_reports() {
        let rec = sample_record();
        let zh = render_markdown_report(&rec, true);
        assert!(zh.starts_with("# 设备自测报告 · Demo Phone A1 · DEMO-R14-001"));
        assert!(zh.contains("- **结论状态**: 通过"));
        assert!(zh.contains("## DRM 信息"));
        assert!(zh.contains("软件包总数: **1**"));

        let en = render_markdown_report(&rec, false);
        assert!(en.starts_with("# Device self-test report · Demo Phone A1"));
        assert!(en.contains("- **Verdict**: Pass"));
        assert!(en.contains("## DRM information"));
        assert!(en.contains("Packages: **1**"));
    }

    #[test]
    fn escapes_csv_fields_and_writes_a_ledger() {
        let mut rec = sample_record();
        rec.note = "a,b \"quoted\"\nnext".into();
        let csv = render_csv_ledger(&[summary_of(&rec)]);
        assert!(csv.starts_with("id,collected_at,serial"));
        assert!(csv.contains("\"a,b \"\"quoted\"\"\nnext\""));
        assert!(csv.contains("DEMO-R14-001"));
    }

    #[test]
    fn accepts_only_safe_record_ids() {
        assert_eq!(
            sanitize_id("20261119-120000-000").as_deref(),
            Some("20261119-120000-000")
        );
        assert_eq!(sanitize_id("abc_def"), Some("abc_def".into()));
        for raw in ["", "../evil", "a/b", "a b", "a.json"] {
            assert_eq!(sanitize_id(raw), None, "accepted {raw:?}");
        }
    }

    #[test]
    fn structured_errors_carry_a_code() {
        let error = SelfTestError::with_message("adb_failed", "device offline");
        assert_eq!(error.code, "adb_failed");
        assert_eq!(error.message.as_deref(), Some("device offline"));
        assert!(
            serde_json::to_string(&SelfTestError::new("io_failed"))
                .unwrap()
                .contains("io_failed")
        );
    }

    #[test]
    fn sanitizes_windows_names_and_avoids_collisions() {
        assert_eq!(
            sanitize_name("  a<b>c:d\"e/f\\g|h?i*j  "),
            "a_b_c_d_e_f_g_h_i_j"
        );
        assert_eq!(sanitize_name("CON"), "_CON");
        assert_eq!(sanitize_name("..."), "record");

        let mut rec = sample_record();
        rec.name = "Same".into();
        let mut other = sample_record();
        other.id = "other".into();
        other.name = "Same".into();
        let index = vec![summary_of(&rec), summary_of(&other)];
        assert_eq!(unique_name(&index, "Same", "new"), "Same-2");
        assert_eq!(unique_name(&index, "Different", "new"), "Different");
    }

    #[test]
    fn default_name_is_semantic() {
        let rec = sample_record();
        assert!(default_name(&rec).starts_with("Demo Phone A1_IR_DEMO-R14-001_20261119"));
    }

    #[test]
    fn encodes_txt_exports_in_three_ways() {
        assert_eq!(encode_text("abc", "utf8"), b"abc");
        assert_eq!(&encode_text("abc", "bom")[..3], &[0xEF, 0xBB, 0xBF]);
        assert_ne!(encode_text("补丁", "gbk"), "补丁".as_bytes());
        assert!(encode_text("补丁", "gbk").len() < "补丁".len());
    }

    #[test]
    fn diff_exposes_unchanged_lists() {
        let left = sample_record();
        let mut right = left.clone();
        right.id = "right".into();
        right.packages = vec!["com.a".into(), "com.c".into()];
        right.features = vec!["android.hardware.drm".into(), "feature.new".into()];
        let diff = compute_diff(&left, &right);
        assert_eq!(diff.packages_same, vec!["com.a"]);
        assert_eq!(diff.packages_added, vec!["com.c"]);
        assert_eq!(diff.features_same, vec!["android.hardware.drm"]);
        assert_eq!(diff.features_added, vec!["feature.new"]);
        assert_eq!(diff.key_fields.len(), 5);
    }
}
