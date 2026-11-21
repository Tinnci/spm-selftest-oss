import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import zh from "./locales/zh-CN.json";

describe("translation catalogs", () => {
  it("define the same keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  it("do not leave copy empty", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), key).not.toBe("");
    }
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim(), key).not.toBe("");
    }
  });
});
