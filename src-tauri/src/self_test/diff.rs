use std::collections::BTreeSet;

use super::*;

pub fn baseline_for(record: &SelfTestRecord, index: &[SelfTestSummary]) -> Option<SelfTestRecord> {
    if !record.baseline_id.trim().is_empty()
        && let Ok(base) = load_record_raw(record.baseline_id.trim())
    {
        return Some(base);
    }
    let candidate = index.iter().find(|item| {
        item.id != record.id
            && ((!record.model_code.is_empty() && item.model_code == record.model_code)
                || (record
                    .fields
                    .get("model")
                    .is_some_and(|model| *model != "(not set)" && *model == item.model)))
    })?;
    load_record_raw(&candidate.id).ok()
}

pub fn baseline_for_review(
    record: &SelfTestRecord,
    baseline_id: Option<&str>,
    index: &[SelfTestSummary],
) -> Option<SelfTestRecord> {
    if let Some(id) = baseline_id.map(str::trim).filter(|value| !value.is_empty()) {
        return load_record_raw(id).ok();
    }
    baseline_for(record, index)
}

pub fn review_plan_for(
    record: &SelfTestRecord,
    baseline_id: Option<&str>,
    index: &[SelfTestSummary],
) -> review::ReviewPlan {
    let baseline = baseline_for_review(record, baseline_id, index);
    let diff = baseline.as_ref().map(|base| compute_diff(base, record));
    review::build_plan(record, baseline.as_ref(), diff.as_ref())
}

pub fn compute_diff(left: &SelfTestRecord, right: &SelfTestRecord) -> SelfTestDiff {
    let mut keys = BTreeSet::new();
    keys.extend(left.fields.keys().cloned());
    keys.extend(right.fields.keys().cloned());

    let mut field_changes = Vec::new();
    for key in keys {
        let l = left.fields.get(&key).cloned().unwrap_or_default();
        let r = right.fields.get(&key).cloned().unwrap_or_default();
        if l != r {
            field_changes.push(SelfTestFieldDiff {
                key,
                left: l,
                right: r,
            });
        }
    }

    let left_drm: BTreeSet<&str> = left.drm_facts.iter().map(String::as_str).collect();
    let right_drm: BTreeSet<&str> = right.drm_facts.iter().map(String::as_str).collect();
    let drm_facts_added = right_drm
        .difference(&left_drm)
        .map(|s| (*s).to_owned())
        .collect();
    let drm_facts_removed = left_drm
        .difference(&right_drm)
        .map(|s| (*s).to_owned())
        .collect();

    let left_pkgs: BTreeSet<&str> = left.packages.iter().map(String::as_str).collect();
    let right_pkgs: BTreeSet<&str> = right.packages.iter().map(String::as_str).collect();
    let packages_added: Vec<String> = right_pkgs
        .difference(&left_pkgs)
        .map(|s| (*s).to_owned())
        .collect();
    let packages_removed: Vec<String> = left_pkgs
        .difference(&right_pkgs)
        .map(|s| (*s).to_owned())
        .collect();
    let packages_same: Vec<String> = left_pkgs
        .intersection(&right_pkgs)
        .map(|s| (*s).to_owned())
        .collect();
    let packages_unchanged = packages_same.len();

    let left_feats: BTreeSet<&str> = left.features.iter().map(String::as_str).collect();
    let right_feats: BTreeSet<&str> = right.features.iter().map(String::as_str).collect();
    let features_added: Vec<String> = right_feats
        .difference(&left_feats)
        .map(|s| (*s).to_owned())
        .collect();
    let features_removed: Vec<String> = left_feats
        .difference(&right_feats)
        .map(|s| (*s).to_owned())
        .collect();
    let features_same: Vec<String> = left_feats
        .intersection(&right_feats)
        .map(|s| (*s).to_owned())
        .collect();
    let features_unchanged = features_same.len();

    let key_fields = ["build", "gms", "patch", "baseos", "fingerprint"]
        .iter()
        .map(|key| SelfTestFieldDiff {
            key: (*key).to_owned(),
            left: left.fields.get(*key).cloned().unwrap_or_default(),
            right: right.fields.get(*key).cloned().unwrap_or_default(),
        })
        .collect();

    SelfTestDiff {
        left_id: left.id.clone(),
        right_id: right.id.clone(),
        field_changes,
        key_fields,
        drm_facts_added,
        drm_facts_removed,
        packages_added,
        packages_removed,
        packages_unchanged,
        packages_same,
        features_added,
        features_removed,
        features_unchanged,
        features_same,
    }
}
