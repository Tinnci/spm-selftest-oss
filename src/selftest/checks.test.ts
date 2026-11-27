import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "../i18n";
import type { SelfTestRecord } from "../api/self_test";
import { checkText } from "./checks";

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
