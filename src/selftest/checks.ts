import type {
  CheckStatus,
  ReviewPlan,
  SelfTestCheck,
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
