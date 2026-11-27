import { call } from "./transport";
import type { Language } from "../i18n";

export type AdbDevice = {
  serial: string;
  state: string;
  model: string;
  product: string;
  device: string;
};

export type SelfTestEnv = {
  adb_found: boolean;
  adb_path: string;
  adb_version: string;
  devices: AdbDevice[];
  error: string | null;
};

export type DrmSection = {
  name: string;
  lines: string[];
};

export type LauncherItem = {
  id: string;
  container: string;
  folder_id?: string | null;
  screen: number;
  cell_x: number;
  cell_y: number;
  span_x: number;
  span_y: number;
  rank?: number;
  item_type: string;
  title: string;
  package: string;
  component: string;
};

export type LauncherLayout = {
  collected_at: string;
  default_launcher: string;
  launcher_package: string;
  display_size: string;
  display_density: string;
  grid_columns: number;
  grid_rows: number;
  hotseat_count: number;
  source: string;
  items: LauncherItem[];
  notes: string[];
};

export type SelfTestVerdict = "pending" | "pass" | "fail";
export type CheckLevel = "pass" | "warn" | "error";
export type CheckStatus = "pass" | "warn" | "error" | "unknown";
export type TestType = "" | "IR" | "MR" | "SMR" | "LR";
export type ExportEncoding = "bom" | "utf8" | "gbk";

export type SelfTestCheck = {
  level: CheckLevel;
  code: string;
  params: Record<string, string>;
};

export type ReviewDecision = {
  state: string;
  note: string;
  at: string;
  by: string;
};

export type ReviewLedger = {
  version: number;
  reviewer: string;
  updated_at: string;
  fingerprint: string;
  baseline_id: string;
  decisions: Record<string, ReviewDecision>;
};

export type ArtifactRef = {
  path: string;
  sha256: string;
  note: string;
  checked: boolean;
};

export type Artifacts = {
  vendor_boot_debug: ArtifactRef;
};

export type ReviewItem = {
  id: string;
  group: string;
  level: string;
  code: string;
  params: Record<string, string>;
  values: Record<string, string>;
  required: boolean;
  can_waive: boolean;
  state: "pending" | "confirmed" | "waived" | "stale" | string;
  note: string;
};

export type ReviewCounts = {
  total: number;
  required: number;
  confirmed: number;
  waived: number;
  pending: number;
  stale: number;
};

export type ReviewPlan = {
  record_id: string;
  baseline_id: string;
  fingerprint: string;
  rule_version: string;
  stale: boolean;
  ready: boolean;
  reviewer: string;
  updated_at: string;
  vendor_boot_required: boolean;
  vendor_boot_backup_recommended: boolean;
  artifacts: Artifacts;
  items: ReviewItem[];
  counts: ReviewCounts;
};

export type ReviewStatusSummary = {
  record_id: string;
  ready: boolean;
  state: "ready" | "pending" | "stale" | "blocked" | string;
  pending: number;
  stale: boolean;
  counts: ReviewCounts;
};

export type HardwareSnapshot = {
  active: Record<string, { source: string; status: string; values: string[] }>;
  inventory: Record<string, string[]>;
  inventory_sources: Record<string, Record<string, string>>;
  mmi: Record<string, string>;
  mmi_status: string;
  issues: string[];
};

export type SelfTestRecord = {
  id: string;
  collected_at: string;
  name: string;
  serial: string;
  adb_path: string;
  adb_version: string;
  note: string;
  test_type: TestType;
  tags: string[];
  model_code: string;
  ota_version: string;
  verdict: SelfTestVerdict;
  baseline_id: string;
  patch_reference: string;
  patch_valid_days: number;
  checks: SelfTestCheck[];
  fields: Record<string, string>;
  drm_facts: string[];
  drm_sections: DrmSection[];
  packages: string[];
  features: string[];
  launcher_layout?: LauncherLayout | null;
  hardware?: HardwareSnapshot | null;
  review?: ReviewLedger;
  artifacts?: Artifacts;
};

export type SelfTestSummary = {
  id: string;
  collected_at: string;
  name: string;
  serial: string;
  note: string;
  test_type: TestType;
  tags: string[];
  model_code: string;
  ota_version: string;
  verdict: SelfTestVerdict;
  check_status: CheckStatus;
  check_errors: number;
  check_warnings: number;
  baseline_id: string;
  patch_reference: string;
  patch_valid_days: number;
  model: string;
  build: string;
  android: string;
  gms: string;
  patch: string;
  package_count: number;
  feature_count: number;
  review_status?: string;
  review_pending?: number;
  reviewer?: string;
  reviewed_at?: string;
  vendor_boot_debug?: string;
  soc_vendor?: string;
  soc_model?: string;
};

export type SelfTestDiff = {
  left_id: string;
  right_id: string;
  field_changes: { key: string; left: string; right: string }[];
  key_fields: { key: string; left: string; right: string }[];
  drm_facts_added: string[];
  drm_facts_removed: string[];
  packages_added: string[];
  packages_removed: string[];
  packages_unchanged: number;
  packages_same: string[];
  features_added: string[];
  features_removed: string[];
  features_unchanged: number;
  features_same: string[];
};

export type SelfTestExportFormat =
  "markdown" | "json" | "csv" | "txt4" | "xlsx";
export type DrmColumn = "section" | "content";
export type XlsxOptions = {
  filename: string;
  sheetNames: [string, string, string, string];
  fields: string[];
  drmColumns: DrmColumn[];
};

export function selfTestEnv(adbPath?: string): Promise<SelfTestEnv> {
  return call<SelfTestEnv>("self_test_env", {
    adbPath: adbPath?.trim() || null,
  });
}

export function selfTestRun(input: {
  adbPath?: string;
  serial: string;
  note?: string;
  name?: string;
  testType?: TestType;
  tags?: string[];
  modelCode?: string;
  otaVersion?: string;
  patchReference?: string;
  patchValidDays?: number;
}): Promise<SelfTestRecord> {
  return call<SelfTestRecord>("self_test_run", {
    adbPath: input.adbPath?.trim() || null,
    serial: input.serial,
    note: input.note?.trim() || null,
    name: input.name?.trim() || null,
    testType: input.testType || null,
    tags: input.tags ?? [],
    modelCode: input.modelCode?.trim() || null,
    otaVersion: input.otaVersion?.trim() || null,
    patchReference: input.patchReference || null,
    patchValidDays: input.patchValidDays ?? null,
  });
}

export function selfTestList(): Promise<SelfTestSummary[]> {
  return call<SelfTestSummary[]>("self_test_list", {});
}

export function selfTestLauncherLayout(
  serial: string,
  adbPath?: string,
): Promise<LauncherLayout> {
  return call<LauncherLayout>("self_test_launcher_layout", {
    adbPath: adbPath?.trim() || null,
    serial,
  });
}

export function selfTestGet(id: string): Promise<SelfTestRecord> {
  return call<SelfTestRecord>("self_test_get", { id });
}

export function selfTestUpdateMeta(input: {
  id: string;
  note: string;
  name: string;
  testType: TestType;
  tags: string[];
  modelCode: string;
  otaVersion: string;
  verdict: SelfTestVerdict;
  patchReference: string;
  patchValidDays: number;
  baselineId?: string | null;
}): Promise<SelfTestRecord> {
  return call<SelfTestRecord>("self_test_update_meta", {
    id: input.id,
    note: input.note,
    name: input.name,
    testType: input.testType,
    tags: input.tags,
    modelCode: input.modelCode,
    otaVersion: input.otaVersion,
    verdict: input.verdict,
    patchReference: input.patchReference,
    patchValidDays: input.patchValidDays,
    baselineId: input.baselineId ?? null,
  });
}

export function selfTestRename(
  id: string,
  name: string,
): Promise<SelfTestRecord> {
  return call<SelfTestRecord>("self_test_rename", { id, name });
}

export function selfTestRecheck(
  id: string,
  baselineId?: string | null,
): Promise<SelfTestRecord> {
  return call<SelfTestRecord>("self_test_recheck", {
    id,
    baselineId: baselineId ?? null,
  });
}

export function selfTestDelete(id: string): Promise<void> {
  return call<void>("self_test_delete", { id });
}

export function selfTestReviewPlan(
  id: string,
  baselineId?: string | null,
): Promise<ReviewPlan> {
  return call<ReviewPlan>("self_test_review_plan", {
    id,
    baselineId: baselineId?.trim() || null,
  });
}

export function selfTestReviewSave(input: {
  id: string;
  baselineId?: string | null;
  fingerprint: string;
  decisions: Record<string, ReviewDecision>;
  artifacts: Artifacts;
}): Promise<SelfTestRecord> {
  return call<SelfTestRecord>("self_test_review_save", {
    id: input.id,
    baselineId: input.baselineId?.trim() || null,
    fingerprint: input.fingerprint,
    decisions: input.decisions,
    artifacts: input.artifacts,
  });
}

export function selfTestReviewStatus(
  ids: string[],
): Promise<ReviewStatusSummary[]> {
  return call<ReviewStatusSummary[]>("self_test_review_status", { ids });
}

export function selfTestDiff(
  leftId: string,
  rightId: string,
): Promise<SelfTestDiff> {
  return call<SelfTestDiff>("self_test_diff", {
    leftId,
    rightId,
  });
}

export function selfTestExportFile(
  id: string,
  format: SelfTestExportFormat,
  language: Language,
  encoding: ExportEncoding = "bom",
  xlsxOptions?: XlsxOptions,
): Promise<string | null> {
  return call<string | null>("self_test_export_file", {
    id,
    format,
    locale: language,
    encoding,
    ...(xlsxOptions ? { xlsxOptions } : {}),
  });
}

export function selfTestStorage(): Promise<string> {
  return call<string>("self_test_storage", {});
}

export function selfTestAdbRestart(adbPath?: string): Promise<SelfTestEnv> {
  return call<SelfTestEnv>("self_test_adb_restart", {
    adbPath: adbPath?.trim() || null,
  });
}

export interface BackupArchiveSummary {
  path: string;
  records: number;
  blobs: number;
  reviews: number;
  imported: number;
  skipped: number;
  overwritten: number;
}

export function exportSelfTestBackup(
  language: Language,
): Promise<BackupArchiveSummary | null> {
  return call<BackupArchiveSummary | null>("self_test_backup_export", {
    locale: language,
  });
}

export function importSelfTestBackup(
  language: Language,
  overwrite = false,
): Promise<BackupArchiveSummary | null> {
  return call<BackupArchiveSummary | null>("self_test_backup_import", {
    locale: language,
    overwrite,
  });
}

export function selfTestWaitDevice(
  adbPath: string | undefined,
  serial: string,
  timeoutSecs = 30,
): Promise<SelfTestEnv> {
  return call<SelfTestEnv>("self_test_wait_device", {
    adbPath: adbPath?.trim() || null,
    serial,
    timeoutSecs,
  });
}
