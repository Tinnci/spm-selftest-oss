import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    throw new Error("desktop only");
  },
}));

const openRepository = vi.fn(() => Promise.resolve());

vi.mock("../src/api/shell", () => ({
  SOURCE_REPOSITORY: "https://github.com/Tinnci/spm-selftest-oss",
  openRepository: () => openRepository(),
  appVersion: () => Promise.resolve("0.1.0"),
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

describe("App shell", () => {
  it("switches theme from the appbar", async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch to dark" }));
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true),
    );
    expect(
      screen.getByRole("button", { name: "Switch to light" }),
    ).toBeTruthy();
  });

  it("starts with groups collapsed and opens them on click", async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(dialog.querySelectorAll("details[open]")).toHaveLength(0);

    const appearance = within(dialog).getByText("Appearance");
    const appearanceGroup = appearance.closest("details");
    await user.hover(appearance);
    expect(appearanceGroup?.open).toBe(false);
    await user.click(appearance);
    expect(appearanceGroup?.open).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Light" })).toBeTruthy();
    await user.click(appearance);
    expect(appearanceGroup?.open).toBe(false);

    const data = within(dialog).getByText("Data");
    await user.click(data);
    expect(await within(dialog).findByText("/tmp/self-tests")).toBeTruthy();
    expect(data.closest("details")?.open).toBe(true);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    expect(
      (await screen.findByRole("dialog")).querySelectorAll("details[open]"),
    ).toHaveLength(0);
  });

  it("links to the open-source repository in About", async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    await user.click(await screen.findByText("About"));
    const repository = await screen.findByRole("link", {
      name: "GitHub repository",
    });
    expect(repository.getAttribute("href")).toBe(
      "https://github.com/Tinnci/spm-selftest-oss",
    );
    expect(screen.getByText("Apache-2.0")).toBeTruthy();
    expect(screen.getByText("Made with love in Shanghai")).toBeTruthy();
    await user.click(repository);
    expect(openRepository).toHaveBeenCalledOnce();
  });

  it("switches language from the appbar", async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch language" }));
    expect(
      await screen.findByRole("heading", { name: "设备自测" }),
    ).toBeTruthy();
  });

  it("saves workbook naming, field order, and record badge visibility", async () => {
    const { unmount } = render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    await user.click(screen.getByText("Record card badges"));
    await user.click(await screen.findByRole("checkbox", { name: "Chipset" }));
    await user.click(screen.getByText("Excel export"));
    await user.type(
      screen.getByRole("textbox", { name: "Filename template" }),
      "QA report",
    );
    await user.type(
      screen.getByRole("textbox", { name: "GMS & Baseline" }),
      "Build",
    );
    const gms = screen.getByText("GMS & Baseline · Fields and order");
    await user.click(gms);
    expect(gms.closest("details")?.open).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Move Record name up" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Record ID" }));
    await user.click(
      screen.getByRole("button", { name: "Save export settings" }),
    );
    expect(readPreferences().xlsx).toMatchObject({
      filename: "QA report",
      sheetNames: ["Build", "", "", ""],
    });
    expect(readPreferences().xlsx.fields.slice(0, 2)).toEqual([
      { key: "@name", enabled: true },
      { key: "@id", enabled: false },
    ]);

    unmount();
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    await user.click(screen.getByText("Record card badges"));
    await user.click(screen.getByText("Excel export"));
    expect(
      (
        await screen.findByRole<HTMLInputElement>("checkbox", {
          name: "Chipset",
        })
      ).checked,
    ).toBe(false);
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "GMS & Baseline" })
        .value,
    ).toBe("Build");
  });
});
