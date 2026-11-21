use std::collections::BTreeMap;

use chrono::Duration;
use spm_selftest::checks::{self, evaluate, status, today};
use spm_selftest::review::{Artifacts, ReviewLedger};
use spm_selftest::self_test::{SelfTestRecord, SelfTestSummary};

fn record(test_type: &str) -> SelfTestRecord {
    let patch = (today() - Duration::days(10))
        .format("%Y-%m-%d")
        .to_string();
    let fields = BTreeMap::from([
        ("build".to_owned(), "V1".to_owned()),
        ("gms".to_owned(), "15_r1".to_owned()),
        ("patch".to_owned(), patch),
        (
            "fingerprint".to_owned(),
            "brand/device:16/V1/user/release-keys".to_owned(),
        ),
        ("firstapi".to_owned(), "36".to_owned()),
        ("sdk".to_owned(), "36".to_owned()),
        ("baseos".to_owned(), String::new()),
        ("buildtype".to_owned(), "user".to_owned()),
        ("tags".to_owned(), "release-keys".to_owned()),
    ]);
    SelfTestRecord {
        id: "r1".to_owned(),
        collected_at: "2026-11-20T10:00:00+08:00".to_owned(),
        name: "r1".to_owned(),
        serial: "S1".to_owned(),
        adb_path: "adb".to_owned(),
        adb_version: "1".to_owned(),
        note: String::new(),
        test_type: test_type.to_owned(),
        tags: Vec::new(),
        model_code: "M1".to_owned(),
        ota_version: "V1".to_owned(),
        verdict: "pending".to_owned(),
        baseline_id: String::new(),
        patch_reference: String::new(),
        patch_valid_days: 90,
        checks: Vec::new(),
        fields,
        drm_facts: Vec::new(),
        drm_sections: Vec::new(),
        packages: Vec::new(),
        features: Vec::new(),
        review: ReviewLedger::default(),
        artifacts: Artifacts::default(),
    }
}

fn has(record: &SelfTestRecord, code: &str) -> bool {
    evaluate(record, None)
        .iter()
        .any(|check| check.code == code)
}

fn baseline_for(record: &SelfTestRecord) -> SelfTestSummary {
    spm_selftest::self_test::summary_of(record)
}

#[test]
fn complete_ir_is_clean() {
    let rec = record("IR");
    let checks = evaluate(&rec, None);
    assert_eq!(status(&checks), "pass");
    assert!(checks.iter().any(|check| check.code == "required_complete"));
}

#[test]
fn ir_rejects_baseos() {
    let mut rec = record("IR");
    rec.fields.insert("baseos".to_owned(), "BP2A".to_owned());
    assert!(has(&rec, "baseos_must_be_empty"));
    assert_eq!(status(&evaluate(&rec, None)), "error");
}

#[test]
fn smr_requires_baseos_and_baseline() {
    let mut rec = record("SMR");
    assert!(has(&rec, "baseos_must_be_set"));
    rec.fields.insert("baseos".to_owned(), "BP2A".to_owned());
    assert!(has(&rec, "baseline_missing"));
}

#[test]
fn lr_rejects_firstapi_sdk_mismatch() {
    let mut rec = record("LR");
    rec.fields.insert("firstapi".to_owned(), "34".to_owned());
    assert!(has(&rec, "firstapi_mismatch"));
    assert_eq!(status(&evaluate(&rec, None)), "error");
}

#[test]
fn expired_patch_is_an_error() {
    let mut rec = record("IR");
    rec.fields.insert(
        "patch".to_owned(),
        (today() - Duration::days(120))
            .format("%Y-%m-%d")
            .to_string(),
    );
    assert!(has(&rec, "patch_expired"));
}

#[test]
fn missing_required_field_is_an_error() {
    let mut rec = record("IR");
    rec.fields.insert("gms".to_owned(), String::new());
    assert!(has(&rec, "required_missing"));
    assert_eq!(status(&evaluate(&rec, None)), "error");
}

#[test]
fn summary_and_baseline_helpers_cover_soc_fields() {
    let mut rec = record("IR");
    rec.fields
        .insert("soc_vendor".to_owned(), "Unisoc".to_owned());
    rec.fields
        .insert("soc_model".to_owned(), "UMS9230".to_owned());
    let summary = baseline_for(&rec);
    assert_eq!(summary.soc_vendor, "Unisoc");
    assert_eq!(summary.soc_model, "UMS9230");
    let _ = checks::counts(&evaluate(&rec, None));
}
