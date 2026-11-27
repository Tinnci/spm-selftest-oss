use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::self_test::{SelfTestCheck, SelfTestDiff, SelfTestRecord};

pub const RULE_VERSION: &str = "review-rule-v1";
pub const REVIEW_VERSION: u32 = 1;

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn short_hash(value: &str) -> String {
    sha256_hex(value.as_bytes())[..12].to_owned()
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewDecision {
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub at: String,
    #[serde(default)]
    pub by: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewLedger {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub reviewer: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub fingerprint: String,
    #[serde(default)]
    pub baseline_id: String,
    #[serde(default)]
    pub decisions: BTreeMap<String, ReviewDecision>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArtifactRef {
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub sha256: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub checked: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Artifacts {
    #[serde(default)]
    pub vendor_boot_debug: ArtifactRef,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReviewItem {
    pub id: String,
    pub group: String,
    pub level: String,
    pub code: String,
    pub params: BTreeMap<String, String>,
    pub values: BTreeMap<String, String>,
    pub required: bool,
    pub can_waive: bool,
    pub state: String,
    pub note: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ReviewCounts {
    pub total: usize,
    pub required: usize,
    pub confirmed: usize,
    pub waived: usize,
    pub pending: usize,
    pub stale: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReviewPlan {
    pub record_id: String,
    pub baseline_id: String,
    pub fingerprint: String,
    pub rule_version: String,
    pub stale: bool,
    pub ready: bool,
    pub reviewer: String,
    pub updated_at: String,
    pub vendor_boot_required: bool,
    pub vendor_boot_backup_recommended: bool,
    pub artifacts: Artifacts,
    pub items: Vec<ReviewItem>,
    pub counts: ReviewCounts,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReviewStatusSummary {
    pub record_id: String,
    pub ready: bool,
    pub state: String,
    pub pending: usize,
    pub stale: bool,
    pub counts: ReviewCounts,
}

#[allow(clippy::too_many_arguments)]
fn item(
    id: String,
    group: &str,
    level: &str,
    code: &str,
    params: BTreeMap<String, String>,
    values: BTreeMap<String, String>,
    required: bool,
    can_waive: bool,
) -> ReviewItem {
    ReviewItem {
        id,
        group: group.to_owned(),
        level: level.to_owned(),
        code: code.to_owned(),
        params,
        values,
        required,
        can_waive,
        state: "pending".to_owned(),
        note: String::new(),
    }
}

fn check_item(check: &SelfTestCheck) -> ReviewItem {
    let params = check.params.clone();
    let signature = serde_json::to_vec(&params).unwrap_or_default();
    let id = format!(
        "check:{}:{}",
        check.code,
        short_hash(&String::from_utf8_lossy(&signature))
    );
    let (group, can_waive) = match check.level.as_str() {
        "error" => ("blocking", false),
        "warn" => ("warning", true),
        _ => ("passing", false),
    };
    item(
        id,
        group,
        &check.level,
        &check.code,
        params,
        BTreeMap::new(),
        true,
        can_waive,
    )
}

fn diff_item(
    group: &str,
    code: &str,
    id: String,
    name: String,
    extra: Option<(&str, String)>,
) -> ReviewItem {
    let mut values = BTreeMap::new();
    values.insert("name".to_owned(), name);
    if let Some((key, value)) = extra {
        values.insert(key.to_owned(), value);
    }
    item(id, group, "info", code, BTreeMap::new(), values, true, true)
}

fn attest_item() -> ReviewItem {
    item(
        "manual:review_attest".to_owned(),
        "manual",
        "info",
        "review_attest",
        BTreeMap::new(),
        BTreeMap::new(),
        true,
        false,
    )
}

fn artifact_item(record: &SelfTestRecord, required: bool, recommended: bool) -> Option<ReviewItem> {
    let artifact = &record.artifacts.vendor_boot_debug;
    if !required
        && !recommended
        && artifact.path.trim().is_empty()
        && artifact.sha256.trim().is_empty()
    {
        return None;
    }
    let mut values = BTreeMap::new();
    values.insert("path".to_owned(), artifact.path.clone());
    values.insert("sha256".to_owned(), artifact.sha256.clone());
    values.insert("note".to_owned(), artifact.note.clone());
    Some(item(
        "artifact:vendor_boot_debug".to_owned(),
        "artifact",
        if required || recommended {
            "warn"
        } else {
            "info"
        },
        "vendor_boot_debug",
        BTreeMap::new(),
        values,
        required,
        true,
    ))
}

pub fn is_unisoc(record: &SelfTestRecord) -> bool {
    crate::soc::is_unisoc(&record.fields)
}

pub fn vendor_boot_required(record: &SelfTestRecord) -> bool {
    is_unisoc(record) && matches!(record.test_type.as_str(), "IR" | "MR")
}

fn diff_items(diff: &SelfTestDiff) -> Vec<ReviewItem> {
    let mut items = Vec::new();
    for change in &diff.field_changes {
        let signature = format!("{}|{}", change.left, change.right);
        items.push(diff_item(
            "diff-field",
            "field",
            format!("diff:field:{}:{}", change.key, short_hash(&signature)),
            change.key.clone(),
            Some(("value", format!("{} -> {}", change.left, change.right))),
        ));
    }
    for name in &diff.packages_added {
        items.push(diff_item(
            "diff-package",
            "package_added",
            format!("diff:pkg:add:{name}"),
            name.clone(),
            None,
        ));
    }
    for name in &diff.packages_removed {
        items.push(diff_item(
            "diff-package",
            "package_removed",
            format!("diff:pkg:remove:{name}"),
            name.clone(),
            None,
        ));
    }
    for name in &diff.features_added {
        items.push(diff_item(
            "diff-feature",
            "feature_added",
            format!("diff:feature:add:{name}"),
            name.clone(),
            None,
        ));
    }
    for name in &diff.features_removed {
        items.push(diff_item(
            "diff-feature",
            "feature_removed",
            format!("diff:feature:remove:{name}"),
            name.clone(),
            None,
        ));
    }
    for name in &diff.drm_facts_added {
        items.push(diff_item(
            "diff-drm",
            "drm_added",
            format!("diff:drm:add:{name}"),
            name.clone(),
            None,
        ));
    }
    for name in &diff.drm_facts_removed {
        items.push(diff_item(
            "diff-drm",
            "drm_removed",
            format!("diff:drm:remove:{name}"),
            name.clone(),
            None,
        ));
    }
    items
}

pub fn fingerprint(
    record: &SelfTestRecord,
    baseline_id: &str,
    diff: Option<&SelfTestDiff>,
) -> String {
    let package_hash = sha256_hex(&serde_json::to_vec(&record.packages).unwrap_or_default());
    let feature_hash = sha256_hex(&serde_json::to_vec(&record.features).unwrap_or_default());
    let payload = serde_json::json!({
        "rule": RULE_VERSION,
        "record": record.id,
        "test_type": record.test_type,
        "baseline": baseline_id,
        "checks": record.checks,
        "fields": record.fields,
        "drm": record.drm_facts,
        "packages": package_hash,
        "features": feature_hash,
        "diff": diff,
    });
    let bytes = serde_json::to_vec(&payload).unwrap_or_default();
    sha256_hex(&bytes)
}

pub fn build_plan(
    record: &SelfTestRecord,
    baseline: Option<&SelfTestRecord>,
    diff: Option<&SelfTestDiff>,
) -> ReviewPlan {
    let baseline_id = baseline.map(|base| base.id.clone()).unwrap_or_default();
    let current_fingerprint = fingerprint(record, &baseline_id, diff);
    let ledger = &record.review;
    let stale = !ledger.fingerprint.is_empty() && ledger.fingerprint != current_fingerprint;

    let mut items = vec![attest_item()];
    items.extend(record.checks.iter().map(check_item));
    if let Some(diff) = diff {
        items.extend(diff_items(diff));
    }
    let required_artifact = vendor_boot_required(record);
    let recommended_artifact = record.test_type == "LR" && is_unisoc(record);
    if let Some(artifact) = artifact_item(record, required_artifact, recommended_artifact) {
        items.push(artifact);
    }

    for item in &mut items {
        if let Some(decision) = ledger.decisions.get(&item.id) {
            if stale {
                item.state = "stale".to_owned();
            } else if decision.state == "confirmed" || decision.state == "waived" {
                item.state = decision.state.clone();
                item.note = decision.note.clone();
            }
        }
    }

    let mut counts = ReviewCounts::default();
    let has_blocking = record.checks.iter().any(|check| check.level == "error");
    for item in &items {
        counts.total += 1;
        if item.required {
            counts.required += 1;
        }
        match item.state.as_str() {
            "confirmed" if item.required => counts.confirmed += 1,
            "waived" if item.required => counts.waived += 1,
            "stale" => {
                counts.stale += 1;
                if item.required {
                    counts.pending += 1;
                }
            }
            _ => {
                if item.required {
                    counts.pending += 1;
                }
            }
        }
    }
    let ready = !stale && counts.pending == 0 && !has_blocking;

    ReviewPlan {
        record_id: record.id.clone(),
        baseline_id,
        fingerprint: current_fingerprint,
        rule_version: RULE_VERSION.to_owned(),
        stale,
        ready,
        reviewer: ledger.reviewer.clone(),
        updated_at: ledger.updated_at.clone(),
        vendor_boot_required: required_artifact,
        vendor_boot_backup_recommended: recommended_artifact,
        artifacts: record.artifacts.clone(),
        items,
        counts,
    }
}

pub fn normalize_artifacts(mut artifacts: Artifacts) -> Artifacts {
    let artifact = &mut artifacts.vendor_boot_debug;
    artifact.path = artifact.path.trim().to_owned();
    artifact.sha256 = artifact.sha256.trim().to_ascii_lowercase();
    artifact.note = artifact.note.trim().to_owned();
    artifact.checked = artifact.checked && !artifact.path.is_empty();
    artifacts
}

pub fn status_of(plan: &ReviewPlan) -> ReviewStatusSummary {
    let state = if plan.ready {
        "ready"
    } else if plan.stale {
        "stale"
    } else if plan.items.iter().any(|item| item.group == "blocking") {
        "blocked"
    } else {
        "pending"
    };
    ReviewStatusSummary {
        record_id: plan.record_id.clone(),
        ready: plan.ready,
        state: state.to_owned(),
        pending: plan.counts.pending,
        stale: plan.stale,
        counts: plan.counts.clone(),
    }
}

pub fn validate_and_build_ledger(
    plan: &ReviewPlan,
    submitted_fingerprint: &str,
    reviewer: &str,
    decisions: &BTreeMap<String, ReviewDecision>,
) -> Result<ReviewLedger, String> {
    if submitted_fingerprint != plan.fingerprint {
        return Err("review_stale".to_owned());
    }
    let reviewer = reviewer.trim();
    if plan.vendor_boot_required && plan.artifacts.vendor_boot_debug.path.trim().is_empty() {
        return Err("review_artifact_required".to_owned());
    }
    let mut normalized = BTreeMap::new();
    for item in &plan.items {
        let Some(decision) = decisions.get(&item.id) else {
            if item.required {
                return Err("review_incomplete".to_owned());
            }
            continue;
        };
        let state = decision.state.as_str();
        if state != "confirmed" && state != "waived" {
            return Err("review_incomplete".to_owned());
        }
        if state == "waived" {
            if !item.can_waive {
                return Err("review_waive_forbidden".to_owned());
            }
            if decision.note.trim().is_empty() {
                return Err("review_note_required".to_owned());
            }
        }
        normalized.insert(
            item.id.clone(),
            ReviewDecision {
                state: state.to_owned(),
                note: decision.note.trim().to_owned(),
                at: now(),
                by: reviewer.to_owned(),
            },
        );
    }
    Ok(ReviewLedger {
        version: REVIEW_VERSION,
        reviewer: reviewer.to_owned(),
        updated_at: now(),
        fingerprint: plan.fingerprint.clone(),
        baseline_id: plan.baseline_id.clone(),
        decisions: normalized,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::self_test::{SelfTestDiff, SelfTestFieldDiff};

    fn record() -> SelfTestRecord {
        SelfTestRecord {
            id: "r1".to_owned(),
            collected_at: "2026-11-20T10:00:00".to_owned(),
            name: "r1".to_owned(),
            serial: "S".to_owned(),
            adb_path: "adb".to_owned(),
            adb_version: "1".to_owned(),
            note: String::new(),
            test_type: "IR".to_owned(),
            tags: Vec::new(),
            model_code: "M".to_owned(),
            ota_version: "V".to_owned(),
            verdict: "pending".to_owned(),
            baseline_id: String::new(),
            patch_reference: "2026-11-20".to_owned(),
            patch_valid_days: 90,
            checks: vec![SelfTestCheck {
                level: "warn".to_owned(),
                code: "build_userdebug".to_owned(),
                params: BTreeMap::new(),
            }],
            fields: BTreeMap::new(),
            drm_facts: Vec::new(),
            drm_sections: Vec::new(),
            packages: Vec::new(),
            features: Vec::new(),
            launcher_layout: None,
            hardware: None,
            review: ReviewLedger::default(),
            artifacts: Artifacts::default(),
        }
    }

    fn diff() -> SelfTestDiff {
        SelfTestDiff {
            left_id: "base".to_owned(),
            right_id: "r1".to_owned(),
            field_changes: vec![SelfTestFieldDiff {
                key: "build".to_owned(),
                left: "A".to_owned(),
                right: "B".to_owned(),
            }],
            key_fields: Vec::new(),
            drm_facts_added: Vec::new(),
            drm_facts_removed: Vec::new(),
            packages_added: vec!["com.new".to_owned()],
            packages_removed: Vec::new(),
            packages_unchanged: 0,
            packages_same: Vec::new(),
            features_added: Vec::new(),
            features_removed: Vec::new(),
            features_unchanged: 0,
            features_same: Vec::new(),
        }
    }

    #[test]
    fn plan_contains_checks_diff_artifact_and_attestation() {
        let mut rec = record();
        rec.fields
            .insert("soc_vendor".to_owned(), "Unisoc".to_owned());
        let plan = build_plan(&rec, None, Some(&diff()));
        assert!(plan.vendor_boot_required);
        assert!(plan.items.iter().any(|i| i.group == "warning"));
        assert!(plan.items.iter().any(|i| i.group == "diff-field"));
        assert!(plan.items.iter().any(|i| i.group == "diff-package"));
        assert!(plan.items.iter().any(|i| i.group == "artifact"));
        assert!(plan.items.iter().any(|i| i.code == "review_attest"));
        assert_eq!(plan.counts.pending, plan.counts.required);
    }

    #[test]
    fn backup_treatment_matches_unisoc_test_type() {
        let mut rec = record();
        for vendor in ["Unisoc", "Qualcomm"] {
            rec.fields
                .insert("soc_vendor".to_owned(), vendor.to_owned());
            for test_type in ["IR", "MR", "LR", "SMR", ""] {
                rec.test_type = test_type.to_owned();
                let plan = build_plan(&rec, None, None);
                assert_eq!(
                    plan.vendor_boot_required,
                    vendor == "Unisoc" && matches!(test_type, "IR" | "MR"),
                );
                assert_eq!(
                    plan.vendor_boot_backup_recommended,
                    vendor == "Unisoc" && test_type == "LR",
                );
            }
        }
    }

    #[test]
    fn passing_checks_and_optional_backup_decisions_persist_without_a_reviewer() {
        let mut rec = record();
        rec.test_type = "LR".to_owned();
        rec.fields
            .insert("soc_vendor".to_owned(), "Unisoc".to_owned());
        rec.checks.push(SelfTestCheck {
            level: "pass".to_owned(),
            code: "patch_valid".to_owned(),
            params: BTreeMap::from([("expiry".to_owned(), "2027-01-30".to_owned())]),
        });
        let plan = build_plan(&rec, None, None);
        let passed = plan
            .items
            .iter()
            .find(|item| item.group == "passing")
            .unwrap();
        assert!(passed.required);
        assert!(!passed.can_waive);
        assert_eq!(passed.params["expiry"], "2027-01-30");
        let mut decisions: BTreeMap<_, _> = plan
            .items
            .iter()
            .filter(|item| item.id != passed.id)
            .map(|item| {
                (
                    item.id.clone(),
                    ReviewDecision {
                        state: "confirmed".to_owned(),
                        ..Default::default()
                    },
                )
            })
            .collect();

        assert_eq!(
            validate_and_build_ledger(&plan, &plan.fingerprint, "", &decisions),
            Err("review_incomplete".to_owned()),
        );
        decisions.insert(
            passed.id.clone(),
            ReviewDecision {
                state: "confirmed".to_owned(),
                ..Default::default()
            },
        );
        rec.review = validate_and_build_ledger(&plan, &plan.fingerprint, "", &decisions).unwrap();
        assert!(rec.review.reviewer.is_empty());
        assert_eq!(
            rec.review.decisions["artifact:vendor_boot_debug"].state,
            "confirmed"
        );
        let done = build_plan(&rec, None, None);
        assert!(done.ready);
        assert_eq!(done.counts.confirmed, done.counts.required);
    }

    #[test]
    fn fingerprint_changes_with_semantic_input_but_not_name() {
        let rec = record();
        let base = fingerprint(&rec, "", None);
        let mut renamed = rec.clone();
        renamed.name = "other".to_owned();
        assert_eq!(base, fingerprint(&renamed, "", None));
        let mut patched = rec.clone();
        patched.checks[0].code = "build_test_keys".to_owned();
        assert_ne!(base, fingerprint(&patched, "", None));
        let mut field_changed = rec.clone();
        field_changed
            .fields
            .insert("build".to_owned(), "B2".to_owned());
        assert_ne!(base, fingerprint(&field_changed, "", None));
        assert_ne!(base, fingerprint(&rec, "base", None));
        assert_ne!(base, fingerprint(&rec, "", Some(&diff())));
    }

    #[test]
    fn stale_when_ledger_fingerprint_changes() {
        let rec = record();
        let mut ledger_rec = rec.clone();
        ledger_rec.review.fingerprint = "old".to_owned();
        ledger_rec.review.decisions.insert(
            "manual:review_attest".to_owned(),
            ReviewDecision {
                state: "confirmed".to_owned(),
                ..Default::default()
            },
        );
        let plan = build_plan(&ledger_rec, None, None);
        assert!(plan.stale);
        assert!(plan.items.iter().any(|i| i.state == "stale"));
        assert!(!plan.ready);
    }

    #[test]
    fn validation_requires_waiver_note_without_reviewer() {
        let rec = record();
        let plan = build_plan(&rec, None, None);
        let mut decisions = BTreeMap::new();
        for item in &plan.items {
            if item.required {
                decisions.insert(
                    item.id.clone(),
                    ReviewDecision {
                        state: if item.can_waive {
                            "waived".to_owned()
                        } else {
                            "confirmed".to_owned()
                        },
                        note: String::new(),
                        ..Default::default()
                    },
                );
            }
        }
        assert_eq!(
            validate_and_build_ledger(&plan, &plan.fingerprint, "Demo reviewer", &decisions),
            Err("review_note_required".to_owned())
        );
        assert_eq!(
            validate_and_build_ledger(&plan, &plan.fingerprint, "", &decisions),
            Err("review_note_required".to_owned())
        );
    }

    #[test]
    fn unisoc_requires_vendor_boot_path() {
        let mut rec = record();
        rec.fields
            .insert("soc_vendor".to_owned(), "Unisoc".to_owned());
        let plan = build_plan(&rec, None, None);
        let mut decisions = BTreeMap::new();
        for item in &plan.items {
            if item.required {
                decisions.insert(
                    item.id.clone(),
                    ReviewDecision {
                        state: "confirmed".to_owned(),
                        note: String::new(),
                        ..Default::default()
                    },
                );
            }
        }
        assert_eq!(
            validate_and_build_ledger(&plan, &plan.fingerprint, "Demo reviewer", &decisions),
            Err("review_artifact_required".to_owned())
        );
        rec.artifacts.vendor_boot_debug.path = "//server/share/vendor_boot-debug.img".to_owned();
        let plan = build_plan(&rec, None, None);
        assert!(
            validate_and_build_ledger(&plan, &plan.fingerprint, "Demo reviewer", &decisions)
                .is_ok()
        );
    }

    #[test]
    fn error_items_cannot_be_waived() {
        let mut rec = record();
        rec.checks.push(SelfTestCheck {
            level: "error".to_owned(),
            code: "required_missing".to_owned(),
            params: BTreeMap::new(),
        });
        let plan = build_plan(&rec, None, None);
        let mut decisions = BTreeMap::new();
        for item in &plan.items {
            if item.required {
                decisions.insert(
                    item.id.clone(),
                    ReviewDecision {
                        state: if item.can_waive {
                            "waived".to_owned()
                        } else {
                            "confirmed".to_owned()
                        },
                        note: "ok".to_owned(),
                        ..Default::default()
                    },
                );
            }
        }
        let error_item = plan.items.iter().find(|i| i.group == "blocking").unwrap();
        decisions.insert(
            error_item.id.clone(),
            ReviewDecision {
                state: "waived".to_owned(),
                note: "why".to_owned(),
                ..Default::default()
            },
        );
        assert_eq!(
            validate_and_build_ledger(&plan, &plan.fingerprint, "Demo reviewer", &decisions),
            Err("review_waive_forbidden".to_owned())
        );
    }
}
