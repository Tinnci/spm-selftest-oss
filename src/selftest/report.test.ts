import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "../i18n";
import type {
  SelfTestDiff,
  SelfTestRecord,
  SelfTestSummary,
} from "../api/self_test";
import {
  fieldLabel,
  pickSmartBaseline,
  recordMarkdown,
  diffMarkdown,
} from "./report";
import { errorText } from "./errors";

const summaries: SelfTestSummary[] = [
  {
    id: "a",
    collected_at: "2026-11-18T10:00:00+08:00",
    serial: "SERIAL-A",
    name: "Demo_IR_V13_20261118",
    test_type: "IR",
    tags: ["internal"],
    check_status: "pass",
    check_errors: 0,
    check_warnings: 0,
    baseline_id: "",
    patch_reference: "2026-11-18",
    patch_valid_days: 90,
    note: "",
    model_code: "DEMO-A1",
    ota_version: "OTA1",
    verdict: "pass",
    model: "Demo Phone A1",
    build: "V13",
    android: "14",
    gms: "14_r1",
    patch: "2026-10-01",
    package_count: 10,
    feature_count: 2,
  },
  {
    id: "b",
    collected_at: "2026-11-19T10:00:00+08:00",
    serial: "SERIAL-B",
    name: "Demo_MR_V14_20261119",
    test_type: "MR",
    tags: [],
    check_status: "warn",
    check_errors: 0,
    check_warnings: 1,
    baseline_id: "a",
    patch_reference: "2026-11-19",
    patch_valid_days: 90,
    note: "",
    model_code: "DEMO-A1",
    ota_version: "OTA2",
    verdict: "pending",
    model: "Demo Phone A1",
    build: "V14",
    android: "15",
    gms: "15_r1",
    patch: "2026-11-01",
    package_count: 11,
    feature_count: 3,
  },
  {
    id: "c",
    collected_at: "2026-11-17T10:00:00+08:00",
    serial: "SERIAL-A",
    name: "Other_LR_X1_20261117",
    test_type: "LR",
    tags: [],
    check_status: "error",
    check_errors: 1,
    check_warnings: 0,
    baseline_id: "",
    patch_reference: "2026-11-17",
    patch_valid_days: 90,
    note: "",
    model_code: "OTHER",
    ota_version: "",
    verdict: "fail",
    model: "Other Device",
    build: "X1",
    android: "13",
    gms: "(not set)",
    patch: "",
    package_count: 3,
    feature_count: 1,
  },
];

const record: SelfTestRecord = {
  id: "b",
  collected_at: "2026-11-19T10:00:00+08:00",
  serial: "SERIAL-B",
  name: "Demo_MR_V14_20261119",
  test_type: "MR",
  tags: ["internal"],

  adb_path: "/usr/bin/adb",
  adb_version: "1.0.41",
  note: "pre-test",
  model_code: "DEMO-A1",
  ota_version: "OTA2",
  verdict: "pass",
  baseline_id: "a",
  patch_reference: "2026-11-19",
  patch_valid_days: 90,
  checks: [
    {
      level: "pass",
      code: "patch_valid",
      params: { expiry: "2027-01-30" },
    },
  ],
  fields: {
    model: "Demo Phone A1",
    build: "V14",
    gms: "15_r1",
  },
  drm_facts: ["securityLevel=L1"],
  drm_sections: [{ name: "services", lines: ["drm.drmManager"] }],
  packages: ["com.a", "com.b"],
  features: ["android.hardware.drm"],
};

const diff: SelfTestDiff = {
  left_id: "a",
  right_id: "b",
  field_changes: [{ key: "gms", left: "14_r1", right: "15_r1" }],
  key_fields: [
    { key: "build", left: "V13", right: "V14" },
    { key: "gms", left: "14_r1", right: "15_r1" },
  ],
  drm_facts_added: ["securityLevel=L3"],
  drm_facts_removed: ["securityLevel=L1"],
  packages_added: ["com.c"],
  packages_removed: ["com.a"],
  packages_unchanged: 1,
  packages_same: ["com.b"],
  features_added: ["feature.new"],
  features_removed: [],
  features_unchanged: 1,
  features_same: ["android.hardware.drm"],
};

beforeEach(async () => {
  await setLanguage("zh-CN");
});

describe("pickSmartBaseline", () => {
  it("prefers the same model code and excludes the target", () => {
    expect(pickSmartBaseline(summaries[1], summaries)).toBe("a");
  });

  it("falls back to the same serial", () => {
    expect(
      pickSmartBaseline({ ...summaries[1], model_code: "NEW" }, summaries),
    ).toBe("a");
  });

  it("returns empty when there is nothing to compare", () => {
    expect(pickSmartBaseline(null, summaries)).toBe("");
    expect(pickSmartBaseline(summaries[0], [summaries[0]])).toBe("");
  });
});

describe("recordMarkdown", () => {
  it("uses localized field labels and escapes table pipes", () => {
    const markdown = recordMarkdown({
      ...record,
      fields: { ...record.fields, gms: "a|b" },
    });
    expect(markdown).toContain("# Demo Phone A1 · V14");
    expect(markdown).toContain("机型");
    expect(markdown).toContain("a\\|b");
  });

  it("renders English labels after a language switch", async () => {
    await setLanguage("en");
    const markdown = recordMarkdown(record);
    expect(markdown).toContain("| Model |");
    expect(markdown).toContain("- Verdict: Pass");
  });
});

describe("diffMarkdown", () => {
  it("includes field, DRM and package changes", () => {
    const markdown = diffMarkdown(record, diff, summaries);
    expect(markdown).toContain("自测版本对比: V13 → V14");
    expect(markdown).toContain("| GMS 版本 | `14_r1` | `15_r1` |");
    expect(markdown).toContain("- + securityLevel=L3");
    expect(markdown).toContain("软件包变更 (+1 / -1)");
  });

  it("localizes diff headings", async () => {
    await setLanguage("en");
    const markdown = diffMarkdown(record, diff, summaries);
    expect(markdown).toContain("Self-test comparison: V13 → V14");
    expect(markdown).toContain("## Field changes");
    expect(markdown).toContain("## Package changes (+1 / -1)");
  });
});

describe("fieldLabel", () => {
  it("keeps unknown keys visible", () => {
    expect(fieldLabel("gms")).toBe("GMS 版本");
    expect(fieldLabel("custom")).toBe("custom");
  });
});

describe("errorText", () => {
  it("maps structured backend codes to localized text", () => {
    expect(errorText({ code: "adb_missing" })).toContain("adb");
    expect(errorText({ code: "io_failed" })).toContain("记录目录");
  });

  it("uses messages for unknown codes and keeps plain strings", () => {
    expect(errorText({ code: "custom_failure", message: "detail" })).toBe(
      "detail",
    );
    expect(errorText("raw error")).toBe("raw error");
    expect(errorText({})).toBe("操作失败，请重试。");
  });
});

describe("recordMarkdown launcher layout", () => {
  it("renders launcher layout summary and screen arrangement when present", () => {
    const md = recordMarkdown({
      ...record,
      launcher_layout: {
        collected_at: "2026-11-25T15:00:00Z",
        default_launcher: "com.android.launcher3/.Launcher",
        launcher_package: "com.android.launcher3",
        display_size: "1080x2340",
        display_density: "440",
        grid_columns: 4,
        grid_rows: 6,
        hotseat_count: 4,
        source: "dumpsys",
        items: [
          {
            id: "23",
            container: "workspace",
            screen: 1,
            cell_x: 1,
            cell_y: 0,
            span_x: 1,
            span_y: 1,
            rank: 0,
            item_type: "app",
            title: "Gemini",
            package: "com.google.android.apps.bard",
            component: "com.google.android.apps.bard/.BardEntryPointActivity",
          },
        ],
        notes: [],
      },
    });
    expect(md).toContain("## Launcher Layout");
    expect(md).toContain("Grid: 4x6 (hotseat 4)");
    expect(md).toContain("Screen 2: Gemini (1,0 1x1)");
  });
});
