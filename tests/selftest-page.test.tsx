import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextMenuProvider } from "../src/components/context-menu";
import { SelfTestPage } from "../src/SelfTestPage";
import { setLanguage } from "../src/i18n";
import { DEFAULT_RECORD_TAGS, DEFAULT_XLSX } from "../src/preferences";

const selfTestList = vi.fn();
const selfTestGet = vi.fn();
const selfTestEnv = vi.fn();
const selfTestRun = vi.fn();
const selfTestUpdateMeta = vi.fn();
const selfTestDelete = vi.fn();
const selfTestDiff = vi.fn();
const selfTestExportFile = vi.fn();
const selfTestReviewPlan = vi.fn();
const selfTestReviewSave = vi.fn();

vi.mock("../src/api/transport", () => ({
  desktop: () => true,
  call: vi.fn(),
  desktopOnly: () => {
    throw new Error("desktop only");
  },
}));

vi.mock("../src/api/self_test", () => ({
  selfTestEnv: (...args: unknown[]) => selfTestEnv(...args),
  selfTestList: (...args: unknown[]) => selfTestList(...args),
  selfTestGet: (...args: unknown[]) => selfTestGet(...args),
  selfTestRun: (...args: unknown[]) => selfTestRun(...args),
  selfTestUpdateMeta: (...args: unknown[]) => selfTestUpdateMeta(...args),
  selfTestDelete: (...args: unknown[]) => selfTestDelete(...args),
  selfTestDiff: (...args: unknown[]) => selfTestDiff(...args),
  selfTestExportFile: (...args: unknown[]) => selfTestExportFile(...args),
  selfTestReviewPlan: (...args: unknown[]) => selfTestReviewPlan(...args),
  selfTestReviewSave: (...args: unknown[]) => selfTestReviewSave(...args),
  selfTestStorage: vi.fn(),
  selfTestRename: vi.fn(),
  selfTestRecheck: vi.fn(),
  selfTestAdbRestart: vi.fn(),
  selfTestWaitDevice: vi.fn(),
}));

const summary = {
  id: "20261119-100000-000",
  collected_at: (() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}T10:00:00+08:00`;
  })(),
  name: "DEMO_IR_V14_20261119",
  serial: "ABC123",
  note: "pre-test",
  test_type: "IR" as const,
  tags: ["internal"],
  model_code: "DEMO-A1",
  ota_version: "OTA2",
  verdict: "pass" as const,
  check_status: "pass" as const,
  check_errors: 0,
  check_warnings: 0,
  baseline_id: "",
  patch_reference: "2026-11-19",
  patch_valid_days: 90,
  model: "Demo Phone A1",
  build: "DEMO-R14-001",
  android: "15",
  gms: "15_r1",
  patch: "2026-11-01",
  package_count: 2,
  feature_count: 1,
  soc_vendor: "Unisoc",
  soc_model: "UMS9230",
};

const detail = {
  id: summary.id,
  collected_at: summary.collected_at,
  name: summary.name,
  serial: summary.serial,
  adb_path: "/usr/bin/adb",
  adb_version: "1.0.41",
  note: summary.note,
  test_type: summary.test_type,
  tags: summary.tags,
  model_code: summary.model_code,
  ota_version: summary.ota_version,
  verdict: summary.verdict,
  baseline_id: "",
  patch_reference: "2026-11-19",
  patch_valid_days: 90,
  checks: [
    {
      level: "pass" as const,
      code: "patch_valid",
      params: { expiry: "2027-01-30" },
    },
  ],
  fields: {
    model: "Demo Phone A1",
    build: "DEMO-R14-001",
    gms: "15_r1",
    soc_vendor: "Unisoc",
    soc_model: "UMS9230",
  },
  drm_facts: ["securityLevel=L1"],
  drm_sections: [],
  packages: ["com.a", "com.b"],
  features: ["android.hardware.drm"],
};

const reviewPlan = {
  record_id: summary.id,
  baseline_id: "",
  fingerprint: "fingerprint",
  rule_version: "review-rule-v1",
  stale: false,
  ready: true,
  reviewer: "Demo reviewer",
  updated_at: "2026-11-19T10:05:00+08:00",
  vendor_boot_required: false,
  vendor_boot_backup_recommended: false,
  artifacts: {
    vendor_boot_debug: { path: "", sha256: "", note: "", checked: false },
  },
  items: [
    {
      id: "manual:review_attest",
      group: "manual",
      level: "info",
      code: "review_attest",
      params: {},
      values: {},
      required: true,
      can_waive: false,
      state: "confirmed",
      note: "",
    },
  ],
  counts: {
    total: 1,
    required: 1,
    confirmed: 1,
    waived: 0,
    pending: 0,
    stale: 0,
  },
};

afterEach(cleanup);

beforeEach(async () => {
  await setLanguage("zh-CN");
  vi.clearAllMocks();
  selfTestEnv.mockResolvedValue({
    adb_found: true,
    adb_path: "/usr/bin/adb",
    adb_version: "1.0.41",
    devices: [
      {
        serial: "ABC123",
        state: "device",
        model: "Demo Phone A1",
        product: "demo_a1",
        device: "demo-phone-a1",
      },
    ],
    error: null,
  });
  selfTestList.mockResolvedValue([summary]);
  selfTestGet.mockResolvedValue(detail);
  selfTestReviewPlan.mockResolvedValue(reviewPlan);
  selfTestReviewSave.mockResolvedValue(detail);
  selfTestDiff.mockResolvedValue({
    left_id: "other",
    right_id: summary.id,
    field_changes: [],
    drm_facts_added: [],
    drm_facts_removed: [],
    packages_added: [],
    packages_removed: [],
    features_added: [],
    features_removed: [],
  });
});

function renderPage(props?: ComponentProps<typeof SelfTestPage>) {
  return render(
    <ContextMenuProvider>
      <SelfTestPage {...props} />
    </ContextMenuProvider>,
  );
}

describe("SelfTestPage", () => {
  it("hides configured record tags and exports enabled XLSX fields in their chosen order", async () => {
    selfTestExportFile.mockResolvedValue(null);
    renderPage({
      recordTags: { ...DEFAULT_RECORD_TAGS, tags: false },
      xlsx: {
        ...DEFAULT_XLSX,
        sheetNames: ["构建信息", "", "", ""],
        fields: [
          { key: "gms", enabled: true },
          { key: "model", enabled: false },
          { key: "build", enabled: true },
        ],
      },
    });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: summary.name });
    expect(screen.queryByText("internal")).toBeNull();
    screen.getByRole("button", { name: "导出" }).focus();
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("menuitem", {
        name: "导出 Excel 工作簿 (.xlsx)",
      }),
    );
    expect(selfTestExportFile).toHaveBeenCalledWith(
      summary.id,
      "xlsx",
      "zh-CN",
      "bom",
      {
        filename: "",
        sheetNames: ["构建信息", "", "", ""],
        fields: ["gms", "build"],
        drmColumns: ["section", "content"],
      },
    );
  });

  it("loads the environment and the newest record", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", {
        name: "DEMO_IR_V14_20261119",
      }),
    ).toBeTruthy();
    expect(screen.getByText("IR · DEMO-R14-001")).toBeTruthy();
    expect(selfTestEnv).toHaveBeenCalled();
    expect(selfTestGet).toHaveBeenCalledWith(summary.id);
  });

  it("enables collection only for a ready device", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建采集" }));
    const run = await screen.findByRole("button", { name: "采集并记录" });
    await waitFor(() =>
      expect((run as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("shows and focuses the saved record after collecting from the dialog", async () => {
    const saved = {
      ...detail,
      id: "20261120-100000-000",
      name: "DEMO_IR_V15_20261120",
    };
    selfTestRun.mockResolvedValue(saved);
    selfTestGet.mockImplementation(async (id: string) =>
      id === saved.id ? saved : detail,
    );
    selfTestList
      .mockResolvedValueOnce([summary])
      .mockResolvedValue([
        { ...summary, id: saved.id, name: saved.name },
        summary,
      ]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: summary.name });
    await user.click(screen.getByRole("button", { name: "新建采集" }));
    await user.click(screen.getByRole("button", { name: "采集并记录" }));
    const heading = await screen.findByRole("heading", { name: saved.name });
    expect(screen.getByText("采集已保存")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("shows the empty state when no record exists", async () => {
    selfTestList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/暂无记录/)).toBeTruthy();
    expect(screen.getByText("从左侧选择一条记录查看详情。")).toBeTruthy();
  });

  it("warns before switching records with unsaved edits", async () => {
    const second = {
      ...summary,
      id: "20261118-090000-000",
      name: "DEMO_IR_V13_20261118",
      build: "V13_20261118",
    };
    selfTestList.mockResolvedValue([summary, second]);
    selfTestGet.mockImplementation((id: string) =>
      Promise.resolve(
        id === summary.id ? detail : { ...detail, id, name: second.name },
      ),
    );

    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });

    await user.click(screen.getByRole("button", { name: "记录信息" }));
    const note = screen.getAllByLabelText("备注").at(-1);
    expect(note).toBeTruthy();
    await user.type(note as HTMLElement, " 改一下");

    await user.click(
      screen.getByRole("button", { name: /DEMO_IR_V13_20261118/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "有未保存的修改" }),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "放弃修改" }));
    expect(
      await screen.findByRole("heading", { name: "DEMO_IR_V13_20261118" }),
    ).toBeTruthy();
  });

  it("focuses the record search with Ctrl+K", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });

    await user.keyboard("{Control>}k{/Control}");
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: /搜索机型/ }),
    );
  });

  it("groups records by day", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    expect(screen.getByText("今天")).toBeTruthy();
  });

  it("refreshes adb devices when the window regains focus", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    const before = selfTestEnv.mock.calls.length;
    fireEvent.focus(window);
    await waitFor(() =>
      expect(selfTestEnv.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it("shows the collected SoC vendor and model", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    expect(screen.getAllByText("Unisoc · UMS9230").length).toBeGreaterThan(0);
    expect(screen.getByText("SoC 厂商")).toBeTruthy();
    expect(screen.getAllByText("UMS9230").length).toBeGreaterThan(0);
  });

  it("previews the submission email before copying", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });

    await user.click(screen.getByRole("button", { name: "提测邮件" }));
    expect(
      await screen.findByRole("heading", { name: "确认生成提测邮件" }),
    ).toBeTruthy();
    await user.click(
      screen.getByText(
        "我已确认核对结果、差异项与交付物无误，可以生成提测邮件。",
      ),
    );
    await user.click(screen.getByRole("button", { name: "生成提测邮件" }));
    expect(
      await screen.findByRole("heading", { name: "提测邮件预览" }),
    ).toBeTruthy();
    const subject = screen.getByLabelText("主题") as HTMLInputElement;
    expect(subject.value).toContain("[GMS送测]");
    expect(screen.getByLabelText("正文").textContent).toContain("DEMO-R14-001");
  });

  it("shows all check levels and saves the review without a reviewer name", async () => {
    selfTestReviewPlan.mockResolvedValue({
      ...reviewPlan,
      ready: false,
      counts: { ...reviewPlan.counts, confirmed: 0, required: 4, pending: 4 },
      items: [
        { ...reviewPlan.items[0], state: "pending" },
        {
          ...reviewPlan.items[0],
          id: "blocking",
          state: "pending",
          group: "blocking",
          level: "error",
          code: "patch_format",
        },
        {
          ...reviewPlan.items[0],
          id: "warning",
          state: "pending",
          group: "warning",
          level: "warn",
          code: "patch_mr_exception",
          params: { patch: "2026-11-01" },
        },
        {
          ...reviewPlan.items[0],
          id: "passing",
          state: "pending",
          group: "passing",
          ...detail.checks[0],
        },
      ],
    });
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    await user.click(screen.getByRole("button", { name: /SPM 核对/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("核对人")).toBeNull();
    expect(
      await within(dialog).findByText("安全补丁在有效期内（至 2027-01-30）"),
    ).toBeTruthy();
    expect(within(dialog).getByText("ERROR")).toBeTruthy();
    expect(within(dialog).getByText("WARN")).toBeTruthy();
    expect(within(dialog).getByText("PASS")).toBeTruthy();
    for (const confirm of within(dialog).getAllByRole("button", {
      name: "确认",
    })) {
      await user.click(confirm);
    }
    await user.click(within(dialog).getByRole("button", { name: "保存核对" }));
    expect(
      await screen.findByRole("heading", { name: "确认完成 SPM 核对" }),
    ).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("heading", { name: "确认完成 SPM 核对" }),
    ).toBeTruthy();
    await user.click(
      screen.getByText("我已逐项手动核对以上内容，并确认结果真实有效。"),
    );
    await user.click(screen.getByRole("button", { name: "确认并保存核对" }));
    await waitFor(() => expect(selfTestReviewSave).toHaveBeenCalled());
    const [input] = selfTestReviewSave.mock.calls[0];
    expect(input).not.toHaveProperty("reviewer");
    expect(input.decisions.passing.state).toBe("confirmed");
  });

  it("asks for confirmation before deleting", async () => {
    selfTestDelete.mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", {
      name: "DEMO_IR_V14_20261119",
    });
    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(await screen.findByRole("menuitem", { name: /删除记录/ }));
    expect(
      await screen.findByRole("heading", { name: "删除记录" }),
    ).toBeTruthy();
    expect(selfTestDelete).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /删除记录/ }));
    await waitFor(() =>
      expect(selfTestDelete).toHaveBeenCalledWith(summary.id),
    );
  });

  it.each(["IR", "MR", "LR"])(
    "shows the Unisoc %s backup reminder in the dock and opens review",
    async (testType) => {
      selfTestGet.mockResolvedValue({ ...detail, test_type: testType });
      selfTestReviewPlan.mockResolvedValue({
        ...reviewPlan,
        vendor_boot_required: testType !== "LR",
        vendor_boot_backup_recommended: testType === "LR",
        items: [
          ...reviewPlan.items,
          {
            ...reviewPlan.items[0],
            id: "artifact:vendor_boot_debug",
            group: "artifact",
            level: "warn",
            code: "vendor_boot_debug",
            required: testType !== "LR",
            state: "pending",
          },
        ],
      });
      renderPage();
      const user = userEvent.setup();
      await screen.findByRole("heading", { name: summary.name });
      const panel = screen.getByRole("region", { name: "校验结果" });
      const action = await within(panel).findByRole("button", {
        name: "登记备份",
      });
      const reminder =
        testType === "LR"
          ? "Unisoc LR 建议备份 vendor_boot_debug，并登记备份路径。"
          : `Unisoc ${testType} 送测前，请备份 vendor_boot_debug、登记路径并完成 SPM 核对。`;
      expect(within(panel).getByText(reminder)).toBeTruthy();
      expect(
        within(panel).getByRole("button", { name: "警告 1" }),
      ).toBeTruthy();
      await user.click(action);
      const dialog = await screen.findByRole("dialog", { name: /SPM 核对/ });
      expect(await within(dialog).findByLabelText("路径")).toBeTruthy();
      expect(within(dialog).getByText(reminder)).toBeTruthy();
    },
  );

  it("clears the backup warning once the registered artifact is confirmed", async () => {
    const savedPlan = {
      ...reviewPlan,
      vendor_boot_required: true,
      artifacts: {
        vendor_boot_debug: {
          ...reviewPlan.artifacts.vendor_boot_debug,
          path: "/backup/vendor_boot-debug.img",
        },
      },
      items: [
        ...reviewPlan.items,
        {
          ...reviewPlan.items[0],
          id: "artifact:vendor_boot_debug",
          code: "vendor_boot_debug",
          state: "pending",
        },
      ],
    };
    selfTestReviewPlan.mockResolvedValue(savedPlan);
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: summary.name });
    const panel = screen.getByRole("region", { name: "校验结果" });
    expect(
      await within(panel).findByRole("button", { name: "核对备份" }),
    ).toBeTruthy();
    selfTestReviewPlan.mockResolvedValue({
      ...savedPlan,
      items: savedPlan.items.map((item) => ({ ...item, state: "confirmed" })),
    });
    await user.click(screen.getByRole("button", { name: "刷新记录" }));
    await waitFor(() => {
      expect(
        within(panel).getByRole("button", { name: "警告 0" }),
      ).toBeTruthy();
    });
  });

  it("opens passing checks on demand and keeps them visible across detail tabs", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: summary.name });
    const panel = screen.getByRole("region", { name: "校验结果" });
    const pass = await within(panel).findByRole("button", { name: "通过 1" });
    const check = "安全补丁在有效期内（至 2027-01-30）";
    expect(within(panel).queryByText(check)).toBeNull();
    await user.click(pass);
    expect(within(panel).getByText(check)).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "DRM 信息" }));
    expect(within(panel).getByText(check)).toBeTruthy();
    expect(
      within(panel).getByRole("button", { name: "重新校验" }),
    ).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "定位字段" }));
    expect(screen.getByRole("tab", { selected: true }).id).toBe(
      "selftest-tab-gms",
    );
    expect(document.activeElement?.getAttribute("data-field")).toBe("patch");
  });

  it("shows issues automatically and reopens the issue list from the record header", async () => {
    selfTestGet.mockResolvedValue({
      ...detail,
      checks: [
        ...detail.checks,
        {
          level: "warn",
          code: "patch_mr_exception",
          params: { patch: "2026-11-01" },
        },
        { level: "error", code: "baseos_required", params: {} },
      ],
    });
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: summary.name });
    const panel = screen.getByRole("region", { name: "校验结果" });
    const collapse = await within(panel).findByRole("button", {
      name: "收起校验结果",
    });
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
    const warning = within(panel).getByRole("button", { name: "警告 1" });
    await user.click(warning);
    expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
    expect(warning.getAttribute("aria-pressed")).toBe("true");
    await user.click(collapse);
    expect(within(panel).queryByRole("list")).toBeNull();
    expect(within(panel).getByRole("button", { name: "阻断 1" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "查看问题" }));
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
  });

  it("moves between detail tabs with the arrow keys", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    screen.getByRole("tab", { selected: true }).focus();
    await user.keyboard("{ArrowRight}");
    expect(
      screen
        .getByRole("tab", { name: "DRM 信息" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("labels the capture fields with visible text", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    await user.click(screen.getByRole("button", { name: "新建采集" }));
    const dialog = screen.getByRole("dialog", { name: "新建采集" });
    expect(within(dialog).getByText(/adb 就绪/)).toBeTruthy();
    expect(within(dialog).getByLabelText("ADB 路径")).toBeTruthy();
    expect(within(dialog).getByLabelText("设备")).toBeTruthy();
    expect(within(dialog).getByLabelText("备注")).toBeTruthy();
  });

  it("offers a clear action when filters match nothing", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "DEMO_IR_V14_20261119" });
    await user.type(
      screen.getByRole("textbox", { name: /搜索机型/ }),
      "no-such-record",
    );
    expect(await screen.findByText("没有匹配的记录")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "清除筛选" }));
    await waitFor(() =>
      expect(screen.queryByText("没有匹配的记录")).toBeNull(),
    );
  });
});
