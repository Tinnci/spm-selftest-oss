import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { HighlightText } from "@/components/ui/highlight-text";
import { FilterableMonoList } from "@/components/self-test/filterable-mono-list";
import { DiffPanel } from "@/components/self-test/diff-panel";
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
});
