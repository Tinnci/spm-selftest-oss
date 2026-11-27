use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::{
    SelfTestError, SelfTestRecord, SelfTestSummary, StoredSelfTestRecord, normalize_record,
    sanitize_id, summary_of, write_atomic,
};

const MAX_ENTRY_BYTES: u64 = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 128 * 1024 * 1024;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupArchiveSummary {
    pub path: String,
    pub records: usize,
    #[serde(default)]
    pub blobs: usize,
    pub reviews: usize,
    pub imported: usize,
    pub skipped: usize,
    pub overwritten: usize,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ArchiveManifest {
    schema_version: u32,
    app: String,
    created_at: String,
    records: usize,
    #[serde(default)]
    blobs: usize,
    reviews: usize,
}

fn collect_json_files(dir: &Path) -> Result<Vec<(String, Vec<u8>)>, SelfTestError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for entry in
        fs::read_dir(dir).map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?
    {
        let entry = entry.map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.ends_with(".json") {
            continue;
        }
        let bytes =
            fs::read(&path).map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
        entries.push((name.to_owned(), bytes));
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(entries)
}

fn read_blob_from_dir(blobs_dir: &Path, hash: &str) -> Option<Vec<String>> {
    let clean = sanitize_id(hash)?;
    let path = blobs_dir.join(format!("{clean}.json"));
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice::<Vec<String>>(&bytes).ok()
}

fn rebuild_index(root_dir: &Path) -> Result<(), SelfTestError> {
    let records_dir = root_dir.join("records");
    let blobs_dir = root_dir.join("blobs");
    let mut summaries: Vec<SelfTestSummary> = Vec::new();
    if records_dir.exists() {
        for entry in fs::read_dir(&records_dir)
            .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?
        {
            let entry =
                entry.map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(bytes) = fs::read(&path)
                && let Ok(stored) = serde_json::from_slice::<StoredSelfTestRecord>(&bytes)
            {
                let packages = match &stored.packages_hash {
                    Some(hash) => read_blob_from_dir(&blobs_dir, hash).unwrap_or(stored.packages),
                    None => stored.packages,
                };
                let features = match &stored.features_hash {
                    Some(hash) => read_blob_from_dir(&blobs_dir, hash).unwrap_or(stored.features),
                    None => stored.features,
                };
                let mut rec = SelfTestRecord {
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
                };
                normalize_record(&mut rec);
                summaries.push(summary_of(&rec));
            }
        }
    }
    summaries.sort_by(|a, b| b.collected_at.cmp(&a.collected_at));
    let payload = serde_json::to_vec_pretty(&summaries)
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    write_atomic(&root_dir.join("index.json"), &payload)
}

fn write_zip_entries(
    tmp_path: &Path,
    manifest_bytes: &[u8],
    records: &[(String, Vec<u8>)],
    blobs: &[(String, Vec<u8>)],
    reviews: &[(String, Vec<u8>)],
) -> Result<(), SelfTestError> {
    let file = File::create(tmp_path)
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    let mut writer = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    writer
        .start_file("manifest.json", opts)
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    writer
        .write_all(manifest_bytes)
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;

    for (folder, entries) in [("records", records), ("blobs", blobs), ("reviews", reviews)] {
        for (name, bytes) in entries {
            writer
                .start_file(format!("{folder}/{name}"), opts)
                .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
            writer
                .write_all(bytes)
                .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
        }
    }
    writer
        .finish()
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    Ok(())
}

pub fn export_backup_zip(
    root_dir: &Path,
    out_path: &Path,
) -> Result<BackupArchiveSummary, SelfTestError> {
    if let Some(parent) = out_path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)
            .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    }
    let records = collect_json_files(&root_dir.join("records"))?;
    let blobs = collect_json_files(&root_dir.join("blobs"))?;
    let reviews = collect_json_files(&root_dir.join("reviews"))?;
    let manifest = ArchiveManifest {
        schema_version: 1,
        app: "spm-selftest".to_owned(),
        created_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        records: records.len(),
        blobs: blobs.len(),
        reviews: reviews.len(),
    };
    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;

    let base_name = out_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("backup.zip");
    let tmp_path = out_path.with_file_name(format!(".{base_name}.tmp-{}", std::process::id()));
    if let Err(err) = write_zip_entries(&tmp_path, &manifest_bytes, &records, &blobs, &reviews) {
        let _ = fs::remove_file(&tmp_path);
        return Err(err);
    }

    #[cfg(windows)]
    if out_path.exists() {
        let _ = fs::remove_file(out_path);
    }
    fs::rename(&tmp_path, out_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        SelfTestError::with_message("io_failed", e.to_string())
    })?;

    Ok(BackupArchiveSummary {
        path: out_path.display().to_string(),
        records: records.len(),
        blobs: blobs.len(),
        reviews: reviews.len(),
        imported: 0,
        skipped: 0,
        overwritten: 0,
    })
}

fn validate_entry_target(name: &str) -> Result<Option<(&'static str, String)>, SelfTestError> {
    if name.contains("..") || name.contains('\\') || name.starts_with('/') {
        return Err(SelfTestError::with_message(
            "invalid_archive",
            format!("unsafe archive entry: {name}"),
        ));
    }
    if name == "manifest.json" {
        return Ok(None);
    }
    let (folder, file_name) = if let Some(rest) = name.strip_prefix("records/") {
        ("records", rest)
    } else if let Some(rest) = name.strip_prefix("blobs/") {
        ("blobs", rest)
    } else if let Some(rest) = name.strip_prefix("reviews/") {
        ("reviews", rest)
    } else {
        return Err(SelfTestError::with_message(
            "invalid_archive",
            format!("unexpected archive entry: {name}"),
        ));
    };
    if file_name.contains('/') || !file_name.ends_with(".json") {
        return Err(SelfTestError::with_message(
            "invalid_archive",
            format!("invalid entry path: {name}"),
        ));
    }
    let stem = file_name.trim_end_matches(".json");
    let clean_id = sanitize_id(stem).ok_or_else(|| {
        SelfTestError::with_message("invalid_archive", format!("invalid id: {stem}"))
    })?;
    Ok(Some((folder, format!("{clean_id}.json"))))
}

pub fn import_backup_zip(
    root_dir: &Path,
    zip_path: &Path,
    overwrite: bool,
) -> Result<BackupArchiveSummary, SelfTestError> {
    let file = File::open(zip_path)
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| SelfTestError::with_message("invalid_archive", e.to_string()))?;

    let mut total_read: u64 = 0;
    let mut staged: Vec<(&'static str, String, Vec<u8>)> = Vec::new();
    let mut seen: HashSet<(&'static str, String)> = HashSet::new();
    let mut records_count = 0usize;
    let mut blobs_count = 0usize;
    let mut reviews_count = 0usize;

    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| SelfTestError::with_message("invalid_archive", e.to_string()))?;
        if entry.is_dir() {
            continue;
        }
        let name = entry
            .name()
            .map_err(|e| SelfTestError::with_message("invalid_archive", e.to_string()))?
            .into_owned();
        if entry.size() > MAX_ENTRY_BYTES {
            return Err(SelfTestError::with_message(
                "invalid_archive",
                format!("entry exceeds size limit: {name}"),
            ));
        }
        let Some((folder, file_name)) = validate_entry_target(&name)? else {
            continue;
        };
        if !seen.insert((folder, file_name.clone())) {
            return Err(SelfTestError::with_message(
                "invalid_archive",
                format!("duplicate archive entry: {folder}/{file_name}"),
            ));
        }

        let mut buf = Vec::new();
        let mut limited = entry.take(MAX_ENTRY_BYTES + 1);
        limited
            .read_to_end(&mut buf)
            .map_err(|e| SelfTestError::with_message("invalid_archive", e.to_string()))?;
        if buf.len() as u64 > MAX_ENTRY_BYTES {
            return Err(SelfTestError::with_message(
                "invalid_archive",
                format!("entry exceeds size limit: {name}"),
            ));
        }
        total_read = total_read.saturating_add(buf.len() as u64);
        if total_read > MAX_TOTAL_BYTES {
            return Err(SelfTestError::with_message(
                "invalid_archive",
                "archive exceeds total unpacked size limit",
            ));
        }

        match folder {
            "records" => {
                serde_json::from_slice::<StoredSelfTestRecord>(&buf).map_err(|e| {
                    SelfTestError::with_message(
                        "invalid_archive",
                        format!("invalid record {file_name}: {e}"),
                    )
                })?;
                records_count += 1;
            }
            "blobs" => {
                serde_json::from_slice::<Vec<String>>(&buf).map_err(|e| {
                    SelfTestError::with_message(
                        "invalid_archive",
                        format!("invalid blob {file_name}: {e}"),
                    )
                })?;
                blobs_count += 1;
            }
            _ => {
                serde_json::from_slice::<serde_json::Value>(&buf).map_err(|e| {
                    SelfTestError::with_message(
                        "invalid_archive",
                        format!("invalid review {file_name}: {e}"),
                    )
                })?;
                reviews_count += 1;
            }
        }
        staged.push((folder, file_name, buf));
    }

    fs::create_dir_all(root_dir.join("records"))
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    fs::create_dir_all(root_dir.join("blobs"))
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;
    fs::create_dir_all(root_dir.join("reviews"))
        .map_err(|e| SelfTestError::with_message("io_failed", e.to_string()))?;

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut overwritten = 0usize;

    for (folder, file_name, bytes) in staged {
        let dest = root_dir.join(folder).join(&file_name);
        if dest.exists() {
            if !overwrite {
                skipped += 1;
                continue;
            }
            overwritten += 1;
        }
        write_atomic(&dest, &bytes)?;
        imported += 1;
    }

    rebuild_index(root_dir)?;

    Ok(BackupArchiveSummary {
        path: zip_path.display().to_string(),
        records: records_count,
        blobs: blobs_count,
        reviews: reviews_count,
        imported,
        skipped,
        overwritten,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn sample_record(id: &str, name: &str) -> SelfTestRecord {
        SelfTestRecord {
            id: id.to_owned(),
            collected_at: "2026-11-25T10:00:00Z".to_owned(),
            name: name.to_owned(),
            serial: "SER123".to_owned(),
            adb_path: "adb".to_owned(),
            adb_version: "35.0".to_owned(),
            note: String::new(),
            test_type: "IR".to_owned(),
            tags: Vec::new(),
            model_code: "M1".to_owned(),
            ota_version: "V1".to_owned(),
            verdict: "pass".to_owned(),
            baseline_id: String::new(),
            patch_reference: String::new(),
            patch_valid_days: 90,
            checks: Vec::new(),
            fields: BTreeMap::new(),
            drm_facts: Vec::new(),
            drm_sections: Vec::new(),
            packages: Vec::new(),
            features: Vec::new(),
            launcher_layout: None,
            hardware: None,
            review: crate::review::ReviewLedger::default(),
            artifacts: crate::review::Artifacts::default(),
        }
    }

    fn temp_dir(label: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "spm_selftest_archive_{label}_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn export_and_import_round_trip_respects_overwrite() {
        let src = temp_dir("src");
        let dst = temp_dir("dst");
        fs::create_dir_all(src.join("records")).unwrap();
        fs::create_dir_all(src.join("blobs")).unwrap();
        fs::create_dir_all(src.join("reviews")).unwrap();

        let rec = sample_record("rec-1", "Original");
        fs::write(
            src.join("records/rec-1.json"),
            serde_json::to_vec_pretty(&rec).unwrap(),
        )
        .unwrap();
        fs::write(src.join("blobs/abc_123-1.json"), br#"["com.example.app"]"#).unwrap();
        fs::write(src.join("reviews/rec-1.json"), br#"{"status":"ok"}"#).unwrap();

        let zip_path = src.join("backup.zip");
        let exported = export_backup_zip(&src, &zip_path).unwrap();
        assert_eq!(exported.records, 1);
        assert_eq!(exported.blobs, 1);
        assert_eq!(exported.reviews, 1);

        let first = import_backup_zip(&dst, &zip_path, false).unwrap();
        assert_eq!(first.imported, 3);
        assert_eq!(first.blobs, 1);
        assert_eq!(first.skipped, 0);
        assert!(dst.join("blobs/abc_123-1.json").is_file());
        assert!(dst.join("index.json").is_file());

        let second = import_backup_zip(&dst, &zip_path, false).unwrap();
        assert_eq!(second.imported, 0);
        assert_eq!(second.skipped, 3);

        let third = import_backup_zip(&dst, &zip_path, true).unwrap();
        assert_eq!(third.imported, 3);
        assert_eq!(third.overwritten, 3);

        let _ = fs::remove_dir_all(&src);
        let _ = fs::remove_dir_all(&dst);
    }

    #[test]
    fn rejects_zip_slip_entries() {
        let dir = temp_dir("zip_slip");
        let zip_path = dir.join("evil.zip");
        {
            let file = File::create(&zip_path).unwrap();
            let mut writer = ZipWriter::new(file);
            writer
                .start_file("../escape.json", SimpleFileOptions::default())
                .unwrap();
            writer.write_all(b"{}").unwrap();
            writer.finish().unwrap();
        }
        let res = import_backup_zip(&dir, &zip_path, true);
        assert!(res.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_duplicate_normalized_entries() {
        let dir = temp_dir("dup_entry");
        let zip_path = dir.join("dup.zip");
        {
            let file = File::create(&zip_path).unwrap();
            let mut writer = ZipWriter::new(file);
            writer
                .start_file("blobs/hash-1.json", SimpleFileOptions::default())
                .unwrap();
            writer.write_all(b"[]").unwrap();
            writer
                .start_file("blobs/ hash-1 .json", SimpleFileOptions::default())
                .unwrap();
            writer.write_all(b"[]").unwrap();
            writer.finish().unwrap();
        }
        let res = import_backup_zip(&dir, &zip_path, true);
        assert!(res.is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
