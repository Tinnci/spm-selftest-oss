import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "../i18n";
import type { SelfTestDiff, SelfTestRecord } from "../api/self_test";
import { checkText, submissionEmail } from "./checks";

const record: SelfTestRecord = {
  id: "r1",
  collected_at: "2026-11-19T10:00:00+08:00",
  name: "Demo_IR_BUILD_20261119",
  serial: "S1",
  adb_path: "/usr/bin/adb",
  adb_version: "1.0.41",
  note: "pre-test",
  test_type: "IR",
  tags: ["internal"],
  model_code: "DEMO-A",
  ota_version: "OTA1",
  verdict: "pending",
  baseline_id: "r0",
  patch_reference: "2026-11-19",
  patch_valid_days: 90,
  checks: [
    {
      level: "error",
      code: "required_missing",
      params: { field: "gms" },
    },
    {
      level: "warn",
      code: "build_userdebug",
      params: {},
    },
    {
      level: "pass",
      code: "patch_valid",
      params: { expiry: "2027-01-30" },
    },
  ],
  fields: {
    model: "Demo",
    build: "B1",
    gms: "(not set)",
    patch: "2026-11-01",
    baseos: "(not set)",
    fingerprint: "brand/model:16/B1/user/release-keys",
    android: "16",
    firstapi: "36",
  },
  drm_facts: [],
  drm_sections: [],
  packages: [],
  features: [],
};

const baseline: SelfTestRecord = {
  ...record,
  id: "r0",
  name: "Demo_IR_BUILD_20261001",
  checks: [],
  baseline_id: "",
};

const diff: SelfTestDiff = {
  left_id: "r0",
  right_id: "r1",
  field_changes: [{ key: "gms", left: "15_r1", right: "16_r1" }],
  key_fields: [],
  drm_facts_added: [],
  drm_facts_removed: [],
  packages_added: ["com.c"],
  packages_removed: ["com.a"],
  packages_unchanged: 2,
  packages_same: ["com.b", "com.d"],
  features_added: [],
  features_removed: [],
  features_unchanged: 1,
  features_same: ["android.hardware.drm"],
};

beforeEach(async () => {
  await setLanguage("zh-CN");
});

describe("checkText", () => {
  it("localizes field parameters", () => {
    expect(checkText(record.checks[0])).toContain("GMS 版本");
  });

  it("localizes warning and pass copy", async () => {
    expect(checkText(record.checks[1])).toContain("userdebug");
    await setLanguage("en");
    expect(checkText(record.checks[1])).toContain("3PL");
  });
});

describe("submissionEmail", () => {
  it("includes the key fields, checks and baseline diff", () => {
    const email = submissionEmail(record, baseline, diff);
    expect(email).toContain("[GMS送测] Demo B1");
    expect(email).toContain("安全补丁: 2026-11-01");
    expect(email).toContain("[ERROR]");
    expect(email).toContain("对比基线：Demo_IR_BUILD_20261001");
    expect(email).toContain("软件包：+1 / -1 / 未变化 2");
    expect(email).toContain("GMS 版本: 15_r1 → 16_r1");
  });

  it("renders an English template after switching language", async () => {
    await setLanguage("en");
    const email = submissionEmail(record, null, null);
    expect(email).toContain("[GMS submission] Demo B1");
    expect(email).toContain("Check results:");
  });
});
