import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { setLanguage } from "../src/i18n";
import { readPreferences } from "../src/preferences";
import { setTheme } from "../src/theme";

vi.mock("../src/api/transport", () => ({
  desktop: () => true,
  call: vi.fn(),
  desktopOnly: () => {
    throw Object.assign(new Error("desktop only"), { code: "unsupported" });
  },
}));

vi.mock("../src/api/shell", () => ({
  SOURCE_REPOSITORY: "https://github.com/Tinnci/spm-selftest-oss",
  openRepository: vi.fn(),
  appVersion: () => Promise.resolve("0.1.1"),
  revealPath: vi.fn(),
  copyText: vi.fn(),
}));

vi.mock("../src/api/session", () => ({
  onCaptionMax: () => Promise.resolve(() => {}),
  watchWindow: () => () => {},
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

vi.mock("../src/api/self_test", () => ({
  selfTestEnv: () =>
    Promise.resolve({
      adb_found: true,
      adb_path: "/usr/bin/adb",
      adb_version: "1.0.41",
      devices: [],
      error: null,
    }),
  selfTestList: () => Promise.resolve([]),
  selfTestGet: vi.fn(),
  selfTestRun: vi.fn(),
  selfTestUpdateMeta: vi.fn(),
  selfTestDelete: vi.fn(),
  selfTestDiff: vi.fn(),
  selfTestExportFile: vi.fn(),
  selfTestStorage: () => Promise.resolve("/tmp/self-tests"),
  selfTestRename: vi.fn(),
  selfTestRecheck: vi.fn(),
  selfTestAdbRestart: vi.fn(),
  selfTestWaitDevice: vi.fn(),
}));

afterEach(cleanup);

beforeEach(async () => {
  window.localStorage.removeItem("spm.selftest.preferences.v1");
  await setLanguage("en");
  setTheme("light");
});

describe("Welcome guide", () => {
  it("opens the guide from rail or strip and persists dismissal", async () => {
    const { unmount } = render(<App />);
    const user = userEvent.setup();

    expect(screen.getByRole("region", { name: "Welcome guide" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Guide" }));
    expect(
      await screen.findByRole("heading", { name: "Welcome to SPM Self-Test" }),
    ).toBeTruthy();
    expect(screen.getByText("Test Type Reference")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Start collecting" }));
    expect(
      await screen.findByRole("heading", { name: "Self-Test" }),
    ).toBeTruthy();
    expect(readPreferences().guideDismissed).toBe(true);
    expect(screen.queryByRole("region", { name: "Welcome guide" })).toBeNull();

    unmount();
    render(<App />);
    expect(screen.queryByRole("region", { name: "Welcome guide" })).toBeNull();
  });
});
