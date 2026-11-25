use std::collections::BTreeMap;

use chrono::{Local, NaiveDate};

use crate::self_test::{SelfTestCheck, SelfTestRecord};

pub const DEFAULT_PATCH_VALID_DAYS: u32 = 90;
const EXPIRY_WARN_DAYS: i64 = 30;

fn check(level: &str, code: &str) -> SelfTestCheck {
    SelfTestCheck {
        level: level.to_owned(),
        code: code.to_owned(),
        params: BTreeMap::new(),
    }
}

fn with(
    level: &str,
    code: &str,
    params: impl IntoIterator<Item = (&'static str, String)>,
) -> SelfTestCheck {
    SelfTestCheck {
        level: level.to_owned(),
        code: code.to_owned(),
        params: params.into_iter().map(|(k, v)| (k.to_owned(), v)).collect(),
    }
}

fn field<'a>(record: &'a SelfTestRecord, key: &str) -> &'a str {
    record.fields.get(key).map(String::as_str).unwrap_or("")
}

fn present(value: &str) -> bool {
    !value.trim().is_empty() && value.trim() != "(not set)"
}

pub fn parse_date(value: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d").ok()
}

pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

pub fn reference_date(record: &SelfTestRecord) -> NaiveDate {
    parse_date(&record.patch_reference).unwrap_or_else(today)
}

pub fn valid_days(record: &SelfTestRecord) -> i64 {
    if record.patch_valid_days == 0 {
        DEFAULT_PATCH_VALID_DAYS as i64
    } else {
        record.patch_valid_days as i64
    }
}

pub fn patch_expiry(record: &SelfTestRecord) -> Option<NaiveDate> {
    let patch = parse_date(field(record, "patch"))?;
    patch.checked_add_signed(chrono::Duration::days(valid_days(record)))
}

fn is_mr(record: &SelfTestRecord) -> bool {
    record.test_type.eq_ignore_ascii_case("MR")
}

fn is_smr(record: &SelfTestRecord) -> bool {
    record.test_type.eq_ignore_ascii_case("SMR")
}

fn is_lr(record: &SelfTestRecord) -> bool {
    record.test_type.eq_ignore_ascii_case("LR")
}

fn is_ir(record: &SelfTestRecord) -> bool {
    record.test_type.eq_ignore_ascii_case("IR")
}

pub fn evaluate(record: &SelfTestRecord, baseline: Option<&SelfTestRecord>) -> Vec<SelfTestCheck> {
    let mut checks = Vec::new();
    let reference = reference_date(record);
    let required = [
        ("build", field(record, "build")),
        ("gms", field(record, "gms")),
        ("patch", field(record, "patch")),
        ("fingerprint", field(record, "fingerprint")),
        ("firstapi", field(record, "firstapi")),
    ];
    let mut missing = Vec::new();
    for (key, value) in required {
        if present(value) {
            checks.push(with("pass", "required_present", [("field", key.into())]));
        } else {
            missing.push(key);
            checks.push(with("error", "required_missing", [("field", key.into())]));
        }
    }

    let patch_raw = field(record, "patch");
    let patch = if present(patch_raw) {
        match parse_date(patch_raw) {
            Some(date) => {
                checks.push(with("pass", "patch_format", []));
                Some(date)
            }
            None => {
                checks.push(with(
                    "error",
                    "patch_format_invalid",
                    [("patch", patch_raw.to_owned())],
                ));
                None
            }
        }
    } else {
        None
    };

    if let Some(patch) = patch {
        let days = valid_days(record);
        let expiry = patch
            .checked_add_signed(chrono::Duration::days(days))
            .unwrap_or(patch);
        let remaining = (expiry - reference).num_days();
        let params = [
            ("patch", patch.format("%Y-%m-%d").to_string()),
            ("reference", reference.format("%Y-%m-%d").to_string()),
            ("expiry", expiry.format("%Y-%m-%d").to_string()),
            ("days", days.to_string()),
            ("remaining", remaining.to_string()),
        ];
        if remaining < 0 {
            checks.push(with("error", "patch_expired", params));
        } else if remaining <= EXPIRY_WARN_DAYS {
            checks.push(with("warn", "patch_expiring", params));
        } else {
            checks.push(with("pass", "patch_valid", params));
        }
    }

    let current_patch = patch;
    let baseline_patch = baseline.and_then(|b| parse_date(field(b, "patch")));
    match (current_patch, baseline_patch) {
        (Some(current), Some(previous)) => {
            if current < previous {
                checks.push(with(
                    "error",
                    "patch_regression",
                    [
                        ("current", current.format("%Y-%m-%d").to_string()),
                        ("baseline", previous.format("%Y-%m-%d").to_string()),
                    ],
                ));
            } else if current == previous {
                let baseline_still_valid = baseline
                    .is_some_and(|b| patch_expiry(b).is_some_and(|expiry| expiry >= reference));
                if is_mr(record) && baseline_still_valid {
                    checks.push(with(
                        "pass",
                        "patch_mr_exception",
                        [("patch", current.format("%Y-%m-%d").to_string())],
                    ));
                } else {
                    checks.push(with(
                        "warn",
                        "patch_unchanged",
                        [("patch", current.format("%Y-%m-%d").to_string())],
                    ));
                }
            } else {
                checks.push(with(
                    "pass",
                    "patch_advanced",
                    [
                        ("current", current.format("%Y-%m-%d").to_string()),
                        ("baseline", previous.format("%Y-%m-%d").to_string()),
                    ],
                ));
            }
        }
        (Some(_), None) if baseline.is_none() && is_mr(record) => {
            checks.push(check("warn", "baseline_missing"));
        }
        _ => {}
    }

    let build_type = field(record, "buildtype");
    let tags = field(record, "tags");
    if build_type.eq_ignore_ascii_case("userdebug") {
        checks.push(check("warn", "build_userdebug"));
    } else if present(build_type) && !build_type.eq_ignore_ascii_case("user") {
        checks.push(with(
            "warn",
            "build_unusual_type",
            [("value", build_type.to_owned())],
        ));
    } else {
        checks.push(check("pass", "build_type_user"));
    }
    if tags
        .split(',')
        .any(|tag| tag.trim().eq_ignore_ascii_case("test-keys"))
    {
        checks.push(check("warn", "build_test_keys"));
    } else {
        checks.push(check("pass", "build_tags_release"));
    }

    let baseos = field(record, "baseos");
    let firstapi = field(record, "firstapi");
    let sdk = field(record, "sdk");

    if record.test_type.trim().is_empty() {
        checks.push(check("warn", "test_type_missing"));
    }

    if is_ir(record) || is_mr(record) || is_lr(record) {
        if present(baseos) {
            checks.push(with(
                "error",
                "baseos_must_be_empty",
                [("type", record.test_type.to_uppercase())],
            ));
        } else {
            checks.push(check("pass", "baseos_empty"));
        }
    }

    if is_smr(record) {
        if !present(baseos) {
            checks.push(check("error", "baseos_must_be_set"));
        } else {
            match baseline {
                None => checks.push(check("warn", "baseline_missing")),
                Some(base) => {
                    let base_baseos = field(base, "baseos");
                    let base_fp = field(base, "fingerprint");
                    let matches = if present(base_baseos) {
                        base_baseos.eq_ignore_ascii_case(baseos)
                    } else if present(base_fp) {
                        base_fp.eq_ignore_ascii_case(field(record, "fingerprint"))
                    } else {
                        false
                    };
                    if !present(base_baseos) && !present(base_fp) {
                        checks.push(check("warn", "baseline_missing_values"));
                    } else if matches {
                        checks.push(check("pass", "baseos_matches_baseline"));
                    } else {
                        checks.push(with(
                            "error",
                            "baseos_mismatch",
                            [
                                ("current", baseos.to_owned()),
                                ("baseline", base_baseos.to_owned()),
                            ],
                        ));
                    }
                }
            }
        }
    }

    if is_lr(record) && present(firstapi) && present(sdk) && firstapi != sdk {
        checks.push(with(
            "error",
            "firstapi_mismatch",
            [("firstapi", firstapi.to_owned()), ("sdk", sdk.to_owned())],
        ));
    } else if is_lr(record) && present(firstapi) && present(sdk) {
        checks.push(check("pass", "firstapi_matches_sdk"));
    }

    if missing.is_empty() {
        checks.push(check("pass", "required_complete"));
    }

    checks
}

pub fn status(checks: &[SelfTestCheck]) -> &'static str {
    if checks.iter().any(|check| check.level == "error") {
        "error"
    } else if checks.iter().any(|check| check.level == "warn") {
        "warn"
    } else if checks.is_empty() {
        "unknown"
    } else {
        "pass"
    }
}

pub fn counts(checks: &[SelfTestCheck]) -> (usize, usize, usize) {
    let errors = checks.iter().filter(|c| c.level == "error").count();
    let warnings = checks.iter().filter(|c| c.level == "warn").count();
    let passes = checks.iter().filter(|c| c.level == "pass").count();
    (errors, warnings, passes)
}

pub fn has_blocking(checks: &[SelfTestCheck]) -> bool {
    checks.iter().any(|check| check.level == "error")
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn record(test_type: &str) -> SelfTestRecord {
        SelfTestRecord {
            id: "r1".into(),
            collected_at: "2026-11-19T10:00:00+08:00".into(),
            name: "Demo_IR_BUILD_20261119".into(),
            serial: "S1".into(),
            adb_path: "adb".into(),
            adb_version: "1".into(),
            note: String::new(),
            test_type: test_type.into(),
            tags: vec![],
            model_code: "DEMO-A".into(),
            ota_version: String::new(),
            verdict: "pending".into(),
            baseline_id: String::new(),
            patch_reference: "2026-11-19".into(),
            patch_valid_days: 90,
            fields: BTreeMap::from([
                ("build".into(), "B1".into()),
                ("android".into(), "16".into()),
                ("sdk".into(), "36".into()),
                ("firstapi".into(), "36".into()),
                ("gms".into(), "16_r1".into()),
                ("patch".into(), "2026-11-01".into()),
                (
                    "fingerprint".into(),
                    "brand/model:16/B1/user/release-keys".into(),
                ),
                ("buildtype".into(), "user".into()),
                ("tags".into(), "release-keys".into()),
                ("baseos".into(), "(not set)".into()),
                ("model".into(), "Demo".into()),
            ]),
            drm_facts: vec![],
            drm_sections: vec![],
            packages: vec![],
            features: vec![],
            launcher_layout: None,
            checks: vec![],
            review: crate::review::ReviewLedger::default(),
            artifacts: crate::review::Artifacts::default(),
        }
    }

    fn has(checks: &[SelfTestCheck], code: &str, level: &str) -> bool {
        checks
            .iter()
            .any(|check| check.code == code && check.level == level)
    }

    #[test]
    fn ir_passes_with_empty_baseos_and_fresh_patch() {
        let checks = evaluate(&record("IR"), None);
        assert_eq!(status(&checks), "pass");
        assert_eq!(counts(&checks).0, 0);
    }

    #[test]
    fn userdebug_and_test_keys_warn() {
        let mut rec = record("IR");
        rec.fields.insert("buildtype".into(), "userdebug".into());
        rec.fields.insert("tags".into(), "test-keys".into());
        let checks = evaluate(&rec, None);
        assert_eq!(status(&checks), "warn");
        assert!(has(&checks, "build_userdebug", "warn"));
        assert!(has(&checks, "build_test_keys", "warn"));
    }

    #[test]
    fn ir_rejects_baseos() {
        let mut rec = record("IR");
        rec.fields.insert("baseos".into(), "BO1".into());
        assert!(has(&evaluate(&rec, None), "baseos_must_be_empty", "error"));
    }

    #[test]
    fn smr_requires_matching_baseos() {
        let mut rec = record("SMR");
        rec.fields.insert("baseos".into(), "BO1".into());
        let mut baseline = record("SMR");
        baseline.id = "r0".into();
        baseline.fields.insert("baseos".into(), "BO2".into());
        assert!(has(
            &evaluate(&rec, Some(&baseline)),
            "baseos_mismatch",
            "error"
        ));
    }

    #[test]
    fn expired_patch_blocks_and_short_window_warns() {
        let mut rec = record("IR");
        rec.fields.insert("patch".into(), "2026-01-01".into());
        assert!(has(&evaluate(&rec, None), "patch_expired", "error"));

        rec.fields.insert("patch".into(), "2026-09-01".into());
        assert!(has(&evaluate(&rec, None), "patch_expiring", "warn"));
    }

    #[test]
    fn patch_regression_blocks_and_mr_carry_over_is_allowed() {
        let current = record("MR");
        let mut baseline = record("IR");
        baseline.id = "r0".into();
        baseline.fields.insert("patch".into(), "2026-11-01".into());
        assert!(has(
            &evaluate(&current, Some(&baseline)),
            "patch_mr_exception",
            "pass"
        ));

        let mut older = current.clone();
        older.fields.insert("patch".into(), "2026-09-01".into());
        assert!(has(
            &evaluate(&older, Some(&baseline)),
            "patch_regression",
            "error"
        ));
    }

    #[test]
    fn lr_requires_first_api_to_match_sdk() {
        let mut rec = record("LR");
        rec.fields.insert("firstapi".into(), "34".into());
        assert!(has(&evaluate(&rec, None), "firstapi_mismatch", "error"));
    }

    #[test]
    fn missing_required_fields_block() {
        let mut rec = record("IR");
        rec.fields.insert("gms".into(), "(not set)".into());
        rec.fields.insert("fingerprint".into(), "(not set)".into());
        assert!(has_blocking(&evaluate(&rec, None)));
    }
}
