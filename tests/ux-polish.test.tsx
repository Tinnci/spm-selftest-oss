import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { HighlightText } from "@/components/ui/highlight-text";
import { FilterableMonoList } from "@/components/self-test/filterable-mono-list";
import { DiffPanel } from "@/components/self-test/diff-panel";
import { DrmPanel } from "@/components/self-test/drm-panel";
import { KeyValueList } from "@/components/self-test/key-value-list";
import { LauncherLayoutPanel } from "@/components/self-test/launcher-panel";
import { RecordSidebar } from "@/components/self-test/record-sidebar";
import { CopyPre } from "@/components/ui/copy-pre";
import { SearchInput } from "@/components/ui/search-input";
import { copyText } from "@/api/shell";
import { DEFAULT_RECORD_TAGS } from "@/preferences";
import { formatRelativeTime, patchCountdown } from "@/selftest/date";
import "@/i18n";

vi.mock("@/api/shell", () => ({
  copyText: vi.fn().mockResolvedValue(undefined),
  revealPath: vi.fn(),
  appVersion: vi.fn().mockResolvedValue("0.1.6"),
  openRepository: vi.fn(),
  SOURCE_REPOSITORY: "https://github.com/Tinnci/spm-selftest-oss",
}));

describe("UX polish helpers and components", () => {
  afterEach(() => cleanup());
  it("computes patchCountdown for valid, soon, and expired dates", () => {
    const valid = patchCountdown("2026-11-01", "2026-11-10", 90);
    expect(valid).toEqual({ remainingDays: 81, expired: false, soon: false });

    const soon = patchCountdown("2026-08-20", "2026-11-10", 90);
    expect(soon).toEqual({ remainingDays: 8, expired: false, soon: true });

    const expired = patchCountdown("2026-07-01", "2026-11-10", 90);
    expect(expired).toEqual({
      remainingDays: -42,
      expired: true,
      soon: false,
    });
  });

  it("formats recent timestamps relatively and falls back for old dates", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(recent, "en")).not.toBe(recent.slice(0, 10));
    expect(formatRelativeTime("2020-01-01T00:00:00Z", "en")).toBe("2020-01-01");
  });

  it("highlights matching substrings without regex issues", () => {
    const { container } = render(
      <HighlightText text="com.google.android.gms" query="gms" />,
    );
    const mark = container.querySelector("mark.ui-highlight");
    expect(mark?.textContent).toBe("gms");
  });

  it("supports click-to-copy and search highlighting in FilterableMonoList", () => {
    const { container } = render(
      <ToastProvider>
        <FilterableMonoList
          items={["com.google.android.gms", "com.android.settings"]}
          filter="gms"
          onFilterChange={vi.fn()}
          placeholder="Filter"
          emptyText="Empty"
          panelId="p"
          tabId="t"
        />
      </ToastProvider>,
    );
    expect(container.querySelector("mark.ui-highlight")?.textContent).toBe(
      "gms",
    );
    const btn = screen.getByRole("button", { name: /gms/i });
    fireEvent.click(btn);
    expect(btn).toBeTruthy();
  });

  it("filters unchanged key fields in DiffPanel when changedOnly is active", () => {
    const detail = {
      id: "r2",
      collected_at: "2026-11-28T10:00:00Z",
      name: "Current",
      serial: "SER2",
      adb_path: "adb",
      adb_version: "1.0",
      note: "",
      test_type: "MR" as const,
      tags: [],
      model_code: "M1",
      ota_version: "V2",
      verdict: "pending" as const,
      baseline_id: "r1",
      patch_reference: "2026-11-28",
      patch_valid_days: 90,
      checks: [],
      fields: { build: "B2" },
      drm_facts: [],
      drm_sections: [],
      packages: [],
      features: [],
    };
    const diff = {
      left_id: "r1",
      right_id: "r2",
      key_fields: [
        { key: "build", left: "B1", right: "B2" },
        { key: "model", left: "Demo", right: "Demo" },
      ],
      field_changes: [{ key: "build", left: "B1", right: "B2" }],
      drm_facts_added: [],
      drm_facts_removed: [],
      packages_added: [],
      packages_removed: [],
      packages_unchanged: 1,
      packages_same: ["com.same"],
      features_added: [],
      features_removed: [],
      features_unchanged: 0,
      features_same: [],
    };
    const onToggle = vi.fn();
    render(
      <TooltipProvider>
        <ToastProvider>
          <DiffPanel
            detail={detail}
            compareId="r1"
            setCompareId={vi.fn()}
            compareCandidates={[]}
            diff={diff}
            diffLoading={false}
            diffTotal={1}
            diffCounts={{ fields: 1, packages: 0, features: 0, drm: 0 }}
            diffScope="all"
            setDiffScope={vi.fn()}
            diffFilter=""
            setDiffFilter={vi.fn()}
            changedOnly={true}
            onToggleChangedOnly={onToggle}
            shownFieldChanges={diff.field_changes}
            shownDrmAdded={[]}
            shownDrmRemoved={[]}
            shownPkgsAdded={[]}
            shownPkgsRemoved={[]}
            shownFeatsAdded={[]}
            shownFeatsRemoved={[]}
            shownPkgsSame={["com.same"]}
            shownFeatsSame={[]}
            handleSwapDiff={vi.fn()}
            handleCopyDiffMarkdown={vi.fn()}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.queryByText("Demo")).toBeNull();
    expect(screen.queryByText("com.same")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Changed only|仅看变更/i }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("supports inline search clear, active filter pills, density toggle, and bulk actions in RecordSidebar", () => {
    const setRecordQuery = vi.fn();
    const setTypeFilter = vi.fn();
    const onToggleDensity = vi.fn();
    const onExportSelected = vi.fn();
    const onBulkDelete = vi.fn();
    const rec = {
      id: "r1",
      collected_at: "2026-11-28T10:00:00Z",
      name: "Demo Run",
      serial: "SER1",
      note: "Sidebar note",
      test_type: "IR" as const,
      tags: ["gms"],
      model_code: "M1",
      ota_version: "V1",
      verdict: "pending" as const,
      check_status: "pass" as const,
      check_errors: 0,
      check_warnings: 0,
      baseline_id: "",
      patch_reference: "2026-11-28",
      patch_valid_days: 90,
      model: "Demo",
      build: "B1",
      android: "16",
      gms: "15_r1",
      patch: "2026-11-01",
      package_count: 10,
      feature_count: 5,
    };

    render(
      <TooltipProvider>
        <ToastProvider>
          <RecordSidebar
            recordTags={DEFAULT_RECORD_TAGS}
            records={[rec]}
            filteredRecords={[rec]}
            recordGroups={[{ key: "today", label: "Today", items: [rec] }]}
            loadingRecords={false}
            selectedId="r1"
            compareId=""
            detail={null}
            selectedIds={["r1"]}
            recordQuery="Demo"
            typeFilter="IR"
            resultFilter="all"
            reviewFilter="all"
            recordSort="newest"
            searchRef={createRef<HTMLInputElement>()}
            setRecordQuery={setRecordQuery}
            setTypeFilter={setTypeFilter}
            setResultFilter={vi.fn()}
            setReviewFilter={vi.fn()}
            setRecordSort={vi.fn()}
            setSelectedIds={vi.fn()}
            setCompareId={vi.fn()}
            showDiff={vi.fn()}
            toggleSelectAll={vi.fn()}
            toggleSelected={vi.fn()}
            handleSelectRecord={vi.fn()}
            refreshList={vi.fn()}
            clearFilters={vi.fn()}
            compareSelected={vi.fn()}
            recordContextActions={() => []}
            handleExport={vi.fn()}
            sidebarDensity="compact"
            onToggleDensity={onToggleDensity}
            onExportSelected={onExportSelected}
            onBulkDelete={onBulkDelete}
          />
        </ToastProvider>
      </TooltipProvider>,
    );

    expect(screen.queryByText("Sidebar note")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Clear search|清空搜索/i }),
    );
    expect(setRecordQuery).toHaveBeenCalledWith("");

    fireEvent.click(
      screen.getByRole("button", { name: /Remove filter: IR|移除筛选：IR/i }),
    );
    expect(setTypeFilter).toHaveBeenCalledWith("all");

    fireEvent.click(
      screen.getByRole("button", { name: /Comfortable view|舒适视图/i }),
    );
    expect(onToggleDensity).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: /Export CSV|导出 CSV/i }),
    );
    expect(onExportSelected).toHaveBeenCalledWith(["r1"]);

    fireEvent.click(screen.getByRole("button", { name: /Delete|删除/i }));
    expect(onBulkDelete).toHaveBeenCalledWith(["r1"]);
  });

  it("supports click-to-copy on KeyValueList values and DrmPanel facts/sections", () => {
    render(
      <ToastProvider>
        <KeyValueList
          items={[{ key: "build", label: "Build ID", value: "BUILD-XYZ" }]}
        />
        <DrmPanel
          facts={["securityLevel=L1"]}
          sections={[{ name: "widevine", lines: ["version=18.0", "level=L1"] }]}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "BUILD-XYZ" }));
    expect(copyText).toHaveBeenCalledWith("BUILD-XYZ");

    fireEvent.click(screen.getByRole("button", { name: "securityLevel=L1" }));
    expect(copyText).toHaveBeenCalledWith("securityLevel=L1");

    const preCopyButtons = screen.getAllByRole("button", {
      name: /Copy value|复制值/i,
    });
    fireEvent.click(preCopyButtons[preCopyButtons.length - 1]);
    expect(copyText).toHaveBeenCalledWith("version=18.0\nlevel=L1");
  });

  it("renders SearchInput, CopyPre, KeyValueList unset state, and LauncherLayoutPanel consistently", () => {
    const onSearchChange = vi.fn();
    const { container } = render(
      <ToastProvider>
        <SearchInput
          value="abc"
          onChange={onSearchChange}
          placeholder="Search"
        />
        <CopyPre text="ro.build.id=XYZ" />
        <KeyValueList
          items={[{ key: "baseos", label: "BaseOS", value: "(not set)" }]}
        />
        <LauncherLayoutPanel
          layout={null}
          serial=""
          inspecting={false}
          onInspectLive={vi.fn()}
        />
      </ToastProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Clear search|清空搜索/i }),
    );
    expect(onSearchChange).toHaveBeenCalledWith("");

    expect(
      container.querySelector(".selftest-kv-value.is-unset")?.textContent,
    ).toBe("(not set)");

    expect(container.querySelector(".selftest-empty")).toBeTruthy();
  });
});
