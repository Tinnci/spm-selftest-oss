use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use super::*;

pub fn platform_base() -> Option<PathBuf> {
    let non_empty = |key: &str| std::env::var_os(key).filter(|value| !value.is_empty());
    if let Some(v) = non_empty("LOCALAPPDATA") {
        Some(PathBuf::from(v))
    } else if let Some(v) = non_empty("XDG_DATA_HOME") {
        Some(PathBuf::from(v))
    } else {
        non_empty("HOME").map(|home| PathBuf::from(home).join(".local/share"))
    }
}

pub fn data_dir() -> Result<PathBuf, SelfTestError> {
    let dir = if let Some(root) = std::env::var_os("SPM_SELFTEST_HOME") {
        PathBuf::from(root)
    } else {
        platform_base()
            .ok_or_else(|| SelfTestError::new("io_failed"))?
            .join("SPM-SelfTest")
    };
    std::fs::create_dir_all(&dir).map_err(|_| SelfTestError::new("io_failed"))?;
    ensure_imported(&dir);
    Ok(dir)
}

pub fn legacy_maon_dir() -> Option<PathBuf> {
    platform_base().map(|base| base.join("Tinnci").join("self-tests"))
}

pub fn dir_has_content(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .map(|entries| entries.flatten().next().is_some())
        .unwrap_or(false)
}

pub fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

pub fn ensure_imported(dir: &Path) {
    if dir.join("index.json").exists() || dir_has_content(dir) {
        return;
    }
    let Some(legacy) = legacy_maon_dir() else {
        return;
    };
    if legacy == dir || !legacy.exists() || !dir_has_content(&legacy) {
        return;
    }
    let _ = copy_tree(&legacy, dir);
}

pub fn records_dir() -> Result<PathBuf, SelfTestError> {
    let dir = data_dir()?.join("records");
    std::fs::create_dir_all(&dir).map_err(|_| SelfTestError::new("io_failed"))?;
    Ok(dir)
}

pub fn blobs_dir() -> Result<PathBuf, SelfTestError> {
    let dir = data_dir()?.join("blobs");
    std::fs::create_dir_all(&dir).map_err(|_| SelfTestError::new("io_failed"))?;
    Ok(dir)
}

pub fn index_path() -> Result<PathBuf, SelfTestError> {
    Ok(data_dir()?.join("index.json"))
}

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), SelfTestError> {
    let parent = path
        .parent()
        .ok_or_else(|| SelfTestError::new("io_failed"))?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("record.json");
    let tmp = parent.join(format!(".{name}.tmp-{}", std::process::id()));
    std::fs::write(&tmp, bytes).map_err(|_| SelfTestError::new("io_failed"))?;
    #[cfg(windows)]
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    std::fs::rename(&tmp, path).map_err(|_| {
        let _ = std::fs::remove_file(&tmp);
        SelfTestError::new("io_failed")
    })
}

pub fn fnv1a_hex(items: &[String]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for item in items {
        for b in item.as_bytes() {
            hash ^= *b as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash ^= b'\n' as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}-{}", items.len())
}

pub fn write_blob(items: &[String]) -> Result<String, SelfTestError> {
    let hash = fnv1a_hex(items);
    let path = blobs_dir()?.join(format!("{hash}.json"));
    if !path.exists() {
        let json = serde_json::to_vec(items).map_err(|_| SelfTestError::new("io_failed"))?;
        write_atomic(&path, &json)?;
    }
    Ok(hash)
}

pub fn read_blob(hash: &str) -> Option<Vec<String>> {
    let clean = sanitize_id(hash)?;
    let path = blobs_dir().ok()?.join(format!("{clean}.json"));
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice::<Vec<String>>(&bytes).ok()
}

pub fn sanitize_id(raw: &str) -> Option<String> {
    let clean = raw.trim();
    if clean.is_empty()
        || !clean
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some(clean.to_owned())
}

pub fn normalize_test_type(raw: &str) -> String {
    match raw.trim().to_ascii_uppercase().as_str() {
        "IR" | "MR" | "SMR" | "LR" => raw.trim().to_ascii_uppercase(),
        _ => String::new(),
    }
}

pub fn sanitize_name(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut last_underscore = false;
    for ch in raw.trim().chars() {
        let invalid =
            ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*');
        let ch = if invalid { '_' } else { ch };
        if ch == '_' {
            if last_underscore {
                continue;
            }
            last_underscore = true;
        } else {
            last_underscore = false;
        }
        out.push(ch);
        if out.chars().count() >= 120 {
            break;
        }
    }
    let trimmed = out.trim().trim_matches('.').trim();
    let clean = if trimmed.is_empty() {
        "record".to_owned()
    } else {
        trimmed.to_owned()
    };
    let upper = clean.to_ascii_uppercase();
    let reserved = matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((upper.starts_with("COM") || upper.starts_with("LPT"))
            && upper.len() == 4
            && upper.as_bytes()[3].is_ascii_digit()
            && upper.as_bytes()[3] != b'0');
    if reserved { format!("_{clean}") } else { clean }
}

pub fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for tag in tags {
        let clean = tag.trim();
        if clean.is_empty() {
            continue;
        }
        let key = clean.to_ascii_lowercase();
        if seen.insert(key) {
            out.push(clean.to_owned());
        }
    }
    out
}

pub fn collected_date(rec: &SelfTestRecord) -> String {
    rec.collected_at.get(0..10).unwrap_or("").replace('-', "")
}

pub fn default_name(rec: &SelfTestRecord) -> String {
    let model = rec
        .fields
        .get("model")
        .map(String::as_str)
        .filter(|v| !v.trim().is_empty() && *v != "(not set)")
        .unwrap_or("device");
    let build = rec
        .fields
        .get("build")
        .map(String::as_str)
        .filter(|v| !v.trim().is_empty() && *v != "(not set)")
        .unwrap_or("build");
    let test_type = if rec.test_type.is_empty() {
        "NA"
    } else {
        rec.test_type.as_str()
    };
    sanitize_name(&format!(
        "{}_{}_{}_{}",
        model,
        test_type,
        build,
        collected_date(rec)
    ))
}

pub fn unique_name(index: &[SelfTestSummary], wanted: &str, id: &str) -> String {
    let base = sanitize_name(wanted);
    let used: BTreeSet<String> = index
        .iter()
        .filter(|item| item.id != id)
        .map(|item| item.name.to_ascii_lowercase())
        .collect();
    if !used.contains(&base.to_ascii_lowercase()) {
        return base;
    }
    for n in 2..10_000 {
        let candidate = format!("{base}-{n}");
        if !used.contains(&candidate.to_ascii_lowercase()) {
            return candidate;
        }
    }
    format!("{base}-{}", std::process::id())
}

pub fn normalize_record(record: &mut SelfTestRecord) {
    record.test_type = normalize_test_type(&record.test_type);
    record.tags = normalize_tags(&record.tags);
    if record.patch_reference.trim().is_empty() {
        record.patch_reference = if record.collected_at.len() >= 10 {
            record.collected_at[0..10].to_owned()
        } else {
            default_patch_reference()
        };
    }
    if record.patch_valid_days == 0 {
        record.patch_valid_days = default_patch_valid_days();
    }
    if record.name.trim().is_empty() {
        record.name = default_name(record);
    }
}

pub fn normalize_summary(item: &mut SelfTestSummary) {
    item.test_type = normalize_test_type(&item.test_type);
    item.tags = normalize_tags(&item.tags);
    if item.patch_reference.trim().is_empty() {
        item.patch_reference = if item.collected_at.len() >= 10 {
            item.collected_at[0..10].to_owned()
        } else {
            default_patch_reference()
        };
    }
    if item.patch_valid_days == 0 {
        item.patch_valid_days = default_patch_valid_days();
    }
    if item.name.trim().is_empty() {
        let date = item.collected_at.get(0..10).unwrap_or("").replace('-', "");
        let test_type = if item.test_type.is_empty() {
            "NA"
        } else {
            &item.test_type
        };
        item.name = sanitize_name(&format!(
            "{}_{}_{}_{}",
            item.model, test_type, item.build, date
        ));
    }
    if item.check_status.is_empty() {
        item.check_status = "unknown".to_owned();
    }
    if item.review_status.is_empty() {
        item.review_status = "pending".to_owned();
    }
}

pub fn upgrade_summaries(items: &mut [SelfTestSummary]) -> bool {
    let snapshot = items.to_vec();
    let mut dirty = false;
    for item in items.iter_mut() {
        if item.check_status != "unknown" && !item.check_status.is_empty() {
            continue;
        }
        let Ok(mut record) = load_record_raw(&item.id) else {
            continue;
        };
        recompute_checks(&mut record, &snapshot);
        *item = summary_of(&record);
        dirty = true;
    }
    dirty
}

pub fn read_index() -> Result<Vec<SelfTestSummary>, SelfTestError> {
    let idx = index_path()?;
    if idx.exists() {
        let bytes = std::fs::read(&idx).map_err(|_| SelfTestError::new("io_failed"))?;
        let mut items = serde_json::from_slice::<Vec<SelfTestSummary>>(&bytes)
            .map_err(|_| SelfTestError::new("io_failed"))?;
        for item in &mut items {
            normalize_summary(item);
        }
        let dirty = upgrade_summaries(&mut items);
        items.sort_by(|a, b| b.collected_at.cmp(&a.collected_at));
        if dirty {
            write_index(&items)?;
        }
        return Ok(items);
    }

    let root = data_dir()?;
    let mut items = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            if path.file_name().and_then(|s| s.to_str()) == Some("index.json") {
                continue;
            }
            if let Ok(bytes) = std::fs::read(&path)
                && let Ok(rec) = serde_json::from_slice::<SelfTestRecord>(&bytes)
            {
                items.push(summary_of(&rec));
                let _ = save_record_internal(&rec);
                let _ = std::fs::remove_file(&path);
            }
        }
    }
    for item in &mut items {
        normalize_summary(item);
    }
    upgrade_summaries(&mut items);
    items.sort_by(|a, b| b.collected_at.cmp(&a.collected_at));
    write_index(&items)?;
    Ok(items)
}

pub fn write_index(items: &[SelfTestSummary]) -> Result<(), SelfTestError> {
    let idx = index_path()?;
    let json = serde_json::to_vec_pretty(items).map_err(|_| SelfTestError::new("io_failed"))?;
    write_atomic(&idx, &json)
}

pub fn save_record_internal(rec: &SelfTestRecord) -> Result<(), SelfTestError> {
    let packages_hash = Some(write_blob(&rec.packages)?);
    let features_hash = Some(write_blob(&rec.features)?);
    let stored = StoredSelfTestRecord {
        id: rec.id.clone(),
        collected_at: rec.collected_at.clone(),
        name: rec.name.clone(),
        serial: rec.serial.clone(),
        adb_path: rec.adb_path.clone(),
        adb_version: rec.adb_version.clone(),
        note: rec.note.clone(),
        test_type: rec.test_type.clone(),
        tags: rec.tags.clone(),
        model_code: rec.model_code.clone(),
        ota_version: rec.ota_version.clone(),
        verdict: rec.verdict.clone(),
        baseline_id: rec.baseline_id.clone(),
        patch_reference: rec.patch_reference.clone(),
        patch_valid_days: rec.patch_valid_days,
        checks: rec.checks.clone(),
        fields: rec.fields.clone(),
        drm_facts: rec.drm_facts.clone(),
        drm_sections: rec.drm_sections.clone(),
        packages_hash,
        features_hash,
        packages: Vec::new(),
        features: Vec::new(),
        launcher_layout: rec.launcher_layout.clone(),
        hardware: rec.hardware.clone(),
        review: rec.review.clone(),
        artifacts: rec.artifacts.clone(),
    };
    let path = records_dir()?.join(format!("{}.json", rec.id));
    let json = serde_json::to_vec_pretty(&stored).map_err(|_| SelfTestError::new("io_failed"))?;
    write_atomic(&path, &json)
}
