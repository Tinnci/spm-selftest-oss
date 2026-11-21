import type { ReviewItem, ReviewPlan } from "../api/self_test";
import { t } from "../i18n";
import { fieldLabel } from "./report";
import { checkText } from "./checks";

export type LocalReviewDecision = {
  state: "confirmed" | "waived" | "";
  note: string;
};

export const REVIEW_GROUP_ORDER = [
  "blocking",
  "warning",
  "passing",
  "manual",
  "diff-field",
  "diff-package",
  "diff-feature",
  "diff-drm",
  "artifact",
];

const GROUP_LABEL: Record<string, string> = {
  blocking: "blocking",
  warning: "warning",
  passing: "passing",
  manual: "manual",
  "diff-field": "diffField",
  "diff-package": "diffPackage",
  "diff-feature": "diffFeature",
  "diff-drm": "diffDrm",
  artifact: "artifact",
};

export function reviewGroupLabel(group: string): string {
  return t("selftest.review.group." + (GROUP_LABEL[group] ?? "manual"));
}

export function reviewItemText(item: ReviewItem): string {
  if (item.group === "manual") return t("selftest.review.item.attest");
  if (item.group === "artifact") {
    return t("selftest.review.item.vendorBoot");
  }
  const name = item.values.name ?? "";
  if (item.group === "diff-field") {
    return t("selftest.review.item.fieldDiff", {
      field: fieldLabel(name),
      change: item.values.value ?? "",
    });
  }
  if (item.group === "diff-package") {
    return t(
      item.code === "package_added"
        ? "selftest.review.item.packageAdded"
        : "selftest.review.item.packageRemoved",
      { name },
    );
  }
  if (item.group === "diff-feature") {
    return t(
      item.code === "feature_added"
        ? "selftest.review.item.featureAdded"
        : "selftest.review.item.featureRemoved",
      { name },
    );
  }
  if (item.group === "diff-drm") {
    return t(
      item.code === "drm_added"
        ? "selftest.review.item.drmAdded"
        : "selftest.review.item.drmRemoved",
      { name },
    );
  }
  return checkText({
    level: item.level as "pass" | "warn" | "error",
    code: item.code,
    params: item.params,
  });
}

export function reviewItemHint(item: ReviewItem): string {
  if (item.group === "artifact") {
    return item.values.path
      ? item.values.path
      : t("selftest.review.artifactMissing");
  }
  return "";
}

export function groupReviewItems(items: ReviewItem[]) {
  const groups = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return REVIEW_GROUP_ORDER.filter((group) => groups.has(group)).map(
    (group) => ({
      group,
      label: reviewGroupLabel(group),
      items: groups.get(group) ?? [],
    }),
  );
}

export function localDecisions(
  plan: ReviewPlan,
): Record<string, LocalReviewDecision> {
  const decisions: Record<string, LocalReviewDecision> = {};
  for (const item of plan.items) {
    decisions[item.id] = {
      state:
        item.state === "confirmed" || item.state === "waived" ? item.state : "",
      note: item.note,
    };
  }
  return decisions;
}

export function reviewProgress(
  plan: ReviewPlan | null,
  decisions: Record<string, LocalReviewDecision>,
) {
  const required = plan?.items.filter((item) => item.required) ?? [];
  const done = required.filter((item) => {
    const state = decisions[item.id]?.state;
    return state === "confirmed" || state === "waived";
  }).length;
  return {
    required: required.length,
    done,
    pending: required.length - done,
  };
}
