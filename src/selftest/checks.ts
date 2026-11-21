import type {
  CheckStatus,
  ReviewPlan,
  SelfTestCheck,
  SelfTestDiff,
  SelfTestRecord,
  TestType,
} from "../api/self_test";
import { t } from "../i18n";
import { fieldLabel } from "./report";

export function checkText(check: SelfTestCheck): string {
  const params: Record<string, string> = { ...check.params };
  if (params.field) params.field = fieldLabel(params.field);
  return t(`selftest.check.${check.code}`, params);
}

export function checkStatusLabel(status: CheckStatus): string {
  return t(`selftest.checkStatus.${status}`);
}

export function checkStatusVariant(
  status: CheckStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "error") return "destructive";
  if (status === "warn") return "secondary";
  if (status === "pass") return "outline";
  return "outline";
}

export function checkStatusTone(status: CheckStatus): string {
  if (status === "error") return "selftest-tone-error";
  if (status === "warn") return "selftest-tone-warn";
  if (status === "pass") return "selftest-tone-pass";
  return "";
}

export function groupedChecks(checks: SelfTestCheck[]) {
  return {
    error: checks.filter((check) => check.level === "error"),
    warn: checks.filter((check) => check.level === "warn"),
    pass: checks.filter((check) => check.level === "pass"),
  };
}

export function vendorBootBackupCheck(
  plan: ReviewPlan,
  testType: TestType,
): SelfTestCheck | undefined {
  const required = plan.vendor_boot_required;
  if (!required && !plan.vendor_boot_backup_recommended) return;

  const item = plan.items.find((item) => item.code === "vendor_boot_debug");
  const reviewed = item?.state === "confirmed" || item?.state === "waived";
  const path = plan.artifacts.vendor_boot_debug?.path.trim();
  if (!required && reviewed) return;
  if (!path) {
    return {
      level: "warn",
      code: required
        ? "vendor_boot_backup_required"
        : "vendor_boot_backup_recommended",
      params: { testType },
    };
  }

  if (required && !reviewed) {
    return {
      level: "warn",
      code: "vendor_boot_backup_pending",
      params: { testType },
    };
  }
}

function field(record: SelfTestRecord, key: string): string {
  return record.fields[key] ?? "-";
}

export function submissionEmail(
  record: SelfTestRecord,
  baseline: SelfTestRecord | null,
  diff: SelfTestDiff | null,
): string {
  const model = field(record, "model");
  const build = field(record, "build");
  const errors = record.checks.filter((check) => check.level === "error");
  const warnings = record.checks.filter((check) => check.level === "warn");
  const status = !record.checks.length
    ? "UNKNOWN"
    : errors.length > 0
      ? "ERROR"
      : warnings.length > 0
        ? "WARN"
        : "PASS";

  const lines = [
    t("selftest.email.subject", { model, build }),
    "",
    t("selftest.email.greeting"),
    "",
    t("selftest.email.intro", { model }),
    "",
    `${t("selftest.field.build")}: ${build}`,
    `${t("selftest.field.gms")}: ${field(record, "gms")}`,
    `${t("selftest.field.patch")}: ${field(record, "patch")}`,
    `${t("selftest.field.baseos")}: ${field(record, "baseos")}`,
    `${t("selftest.field.fingerprint")}: ${field(record, "fingerprint")}`,
    `${t("selftest.field.android")}: ${field(record, "android")}`,
    `${t("selftest.field.firstapi")}: ${field(record, "firstapi")}`,
    `${t("selftest.field.soc_vendor")}: ${field(record, "soc_vendor")}`,
    `${t("selftest.field.soc_model")}: ${field(record, "soc_model")}`,
    `${t("selftest.email.type")}: ${record.test_type || "-"}`,
    `${t("selftest.email.verdict")}: ${status}`,
  ];

  if (record.name) lines.push(`${t("selftest.email.name")}: ${record.name}`);
  if (record.note) lines.push(`${t("selftest.email.note")}: ${record.note}`);

  lines.push("", t("selftest.email.checks"));
  if (!record.checks.length) {
    lines.push(`- ${t("selftest.email.noChecks")}`);
  } else {
    for (const check of record.checks) {
      if (check.level === "pass") continue;
      lines.push(`- [${check.level.toUpperCase()}] ${checkText(check)}`);
    }
    if (!errors.length && !warnings.length) {
      lines.push(`- [PASS] ${t("selftest.email.allPassed")}`);
    }
  }

  if (baseline) {
    lines.push(
      "",
      t("selftest.email.baseline", {
        name: baseline.name || baseline.id,
        build: field(baseline, "build"),
      }),
    );
    if (diff) {
      lines.push(
        t("selftest.email.diffPackages", {
          added: diff.packages_added.length,
          removed: diff.packages_removed.length,
          unchanged: diff.packages_unchanged,
        }),
        t("selftest.email.diffFeatures", {
          added: diff.features_added.length,
          removed: diff.features_removed.length,
          unchanged: diff.features_unchanged,
        }),
      );
      if (diff.field_changes.length) {
        lines.push(t("selftest.email.diffFields"));
        for (const change of diff.field_changes) {
          lines.push(
            `- ${fieldLabel(change.key)}: ${change.left || "-"} → ${change.right || "-"}`,
          );
        }
      }
    }
  }

  const review = record.review;
  if (review?.updated_at) {
    const decisions = Object.values(review.decisions ?? {});
    const confirmed = decisions.filter(
      (item) => item.state === "confirmed",
    ).length;
    const waived = decisions.filter((item) => item.state === "waived").length;
    lines.push(
      "",
      t("selftest.email.review"),
      ...(review.reviewer
        ? [t("selftest.email.reviewer") + ": " + review.reviewer]
        : []),
      t("selftest.email.reviewedAt") + ": " + review.updated_at,
      t("selftest.email.reviewConfirmed") + ": " + confirmed,
      t("selftest.email.reviewWaived") + ": " + waived,
    );
  }

  const vendorBoot = record.artifacts?.vendor_boot_debug;
  if (vendorBoot?.path) {
    lines.push(
      "",
      t("selftest.email.vendorBoot"),
      t("selftest.email.vendorBootPath") + ": " + vendorBoot.path,
    );
    if (vendorBoot.sha256) {
      lines.push("SHA256: " + vendorBoot.sha256);
    }
    if (vendorBoot.note) {
      lines.push(t("selftest.email.vendorBootNote") + ": " + vendorBoot.note);
    }
  }

  lines.push("", t("selftest.email.signature"), t("selftest.email.footer"));
  return lines.join("\n");
}

export function submissionEmailBlock(record: SelfTestRecord): string {
  const build = field(record, "build");
  const lines = [
    t("selftest.email.otherVersion", {
      model: field(record, "model"),
      build,
    }),
    `${t("selftest.field.build")}: ${build}`,
    `${t("selftest.field.gms")}: ${field(record, "gms")}`,
    `${t("selftest.field.patch")}: ${field(record, "patch")}`,
    `${t("selftest.field.baseos")}: ${field(record, "baseos")}`,
    `${t("selftest.field.fingerprint")}: ${field(record, "fingerprint")}`,
    `${t("selftest.field.android")}: ${field(record, "android")}`,
    `${t("selftest.field.firstapi")}: ${field(record, "firstapi")}`,
    `${t("selftest.field.soc_vendor")}: ${field(record, "soc_vendor")}`,
    `${t("selftest.field.soc_model")}: ${field(record, "soc_model")}`,
    `${t("selftest.email.type")}: ${record.test_type || "-"}`,
  ];
  return lines.join("\n");
}
