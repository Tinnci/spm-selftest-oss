use std::collections::BTreeMap;

use super::*;

pub fn parse_getprop_map(raw: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix('[')
            && let Some((key, val_part)) = rest.split_once("]:")
        {
            let val_trimmed = val_part.trim();
            if let Some(inner) = val_trimmed
                .strip_prefix('[')
                .and_then(|s| s.strip_suffix(']'))
            {
                map.insert(key.to_owned(), inner.to_owned());
            }
        }
    }
    map
}

pub fn extract_key_fields(props: &BTreeMap<String, String>) -> BTreeMap<String, String> {
    let defs: &[(&str, &[&str])] = &[
        (
            "build",
            &[
                "ro.build.display.id",
                "ro.build.version.incremental",
                "ro.build.id",
            ],
        ),
        ("buildtype", &["ro.build.type"]),
        ("tags", &["ro.build.tags"]),
        ("android", &["ro.build.version.release"]),
        ("sdk", &["ro.build.version.sdk"]),
        (
            "firstapi",
            &[
                "ro.product.first_api_level",
                "ro.board.first_api_level",
                "ro.vendor.build.version.sdk",
            ],
        ),
        (
            "baseband",
            &[
                "gsm.version.baseband",
                "ro.build.expect.baseband",
                "ro.vendor.build.version.baseband",
                "ro.baseband",
                "ro.boot.baseband",
            ],
        ),
        ("gms", &["ro.com.google.gmsversion"]),
        ("patch", &["ro.build.version.security_patch"]),
        ("vpatch", &["ro.vendor.build.version.security_patch"]),
        (
            "fingerprint",
            &["ro.build.fingerprint", "ro.system.build.fingerprint"],
        ),
        ("vfingerprint", &["ro.vendor.build.fingerprint"]),
        (
            "baseos",
            &[
                "ro.build.version.base_os",
                "ro.vendor.build.version.base_os",
            ],
        ),
        (
            "vendor",
            &["ro.vendor.build.version.incremental", "ro.vendor.build.id"],
        ),
        ("model", &["ro.product.model", "ro.product.vendor.model"]),
        ("device", &["ro.product.device"]),
        ("manufacturer", &["ro.product.manufacturer"]),
        ("builddate", &["ro.build.date"]),
    ];

    let mut out = BTreeMap::new();
    for (id, keys) in defs {
        let val = keys
            .iter()
            .find_map(|k| {
                props
                    .get(*k)
                    .map(|v| v.trim())
                    .filter(|v| !v.is_empty())
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| "(not set)".to_owned());
        out.insert((*id).to_owned(), val);
    }

    let (soc_vendor, soc_model) = crate::soc::from_props(props);
    out.insert("soc_vendor".to_owned(), soc_vendor);
    out.insert("soc_model".to_owned(), soc_model);
    out
}

pub fn is_drm_line(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    [
        "drm",
        "widevine",
        "playready",
        "clearkey",
        "marvin",
        "hdcp",
        "oemcrypto",
    ]
    .iter()
    .any(|kw| lower.contains(kw))
}

pub fn clean_list_lines(raw: &str, prefix: &str) -> Vec<String> {
    let mut lines = raw
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('*'))
        .map(|l| l.strip_prefix(prefix).unwrap_or(l).trim().to_owned())
        .collect::<Vec<_>>();
    lines.sort();
    lines.dedup();
    lines
}

pub fn summary_of(rec: &SelfTestRecord) -> SelfTestSummary {
    let get = |k: &str| {
        rec.fields
            .get(k)
            .cloned()
            .unwrap_or_else(|| "(not set)".to_owned())
    };
    let (errors, warnings, _) = crate::checks::counts(&rec.checks);
    let check_status = if rec.checks.is_empty() {
        "unknown"
    } else {
        crate::checks::status(&rec.checks)
    };
    SelfTestSummary {
        id: rec.id.clone(),
        collected_at: rec.collected_at.clone(),
        name: rec.name.clone(),
        serial: rec.serial.clone(),
        note: rec.note.clone(),
        test_type: rec.test_type.clone(),
        tags: rec.tags.clone(),
        model_code: rec.model_code.clone(),
        ota_version: rec.ota_version.clone(),
        verdict: rec.verdict.clone(),
        check_status: check_status.to_owned(),
        check_errors: errors,
        check_warnings: warnings,
        baseline_id: rec.baseline_id.clone(),
        patch_reference: rec.patch_reference.clone(),
        patch_valid_days: rec.patch_valid_days,
        model: get("model"),
        build: get("build"),
        android: get("android"),
        gms: get("gms"),
        patch: get("patch"),
        package_count: rec.packages.len(),
        feature_count: rec.features.len(),
        review_status: if rec.review.updated_at.trim().is_empty() {
            "pending".to_owned()
        } else {
            "reviewed".to_owned()
        },
        review_pending: 0,
        reviewer: rec.review.reviewer.clone(),
        reviewed_at: rec.review.updated_at.clone(),
        vendor_boot_debug: rec.artifacts.vendor_boot_debug.path.clone(),
        soc_vendor: rec
            .fields
            .get("soc_vendor")
            .filter(|value| value.as_str() != "(not set)")
            .cloned()
            .unwrap_or_default(),
        soc_model: rec
            .fields
            .get("soc_model")
            .filter(|value| value.as_str() != "(not set)")
            .cloned()
            .unwrap_or_default(),
    }
}
