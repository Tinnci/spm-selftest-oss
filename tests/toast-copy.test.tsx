import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyValueList } from "../src/components/self-test/key-value-list";
import { ScrollableTabs } from "../src/components/ui/scrollable-tabs";
import { ToastProvider } from "../src/components/ui/toast";
import { useCopyWithToast } from "../src/hooks/useCopyWithToast";

const copyText = vi.fn();

vi.mock("../src/clipboard", () => ({
  copyText: (...args: unknown[]) => copyText(...args),
}));

function CopyHarness({ text }: { text: string }) {
  const copyWithToast = useCopyWithToast();
  return (
    <button type="button" onClick={() => void copyWithToast(text)}>
      Copy
    </button>
  );
}

describe("useCopyWithToast", () => {
  afterEach(() => {
    cleanup();
    copyText.mockReset();
  });

  it("shows a success toast when copyText resolves", async () => {
    copyText.mockResolvedValue(undefined);
    render(
      <ToastProvider>
        <CopyHarness text="hello-world" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => {
      expect(copyText).toHaveBeenCalledWith("hello-world");
    });
    expect(await screen.findByText("已复制")).toBeTruthy();
  });

  it("shows an error toast when copyText rejects", async () => {
    copyText.mockRejectedValue(new Error("clipboard denied"));
    render(
      <ToastProvider>
        <CopyHarness text="fail-case" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("复制失败")).toBeTruthy();
  });

  it("morphs KeyValueList copy button into copied state", async () => {
    copyText.mockResolvedValue(undefined);
    render(
      <ToastProvider>
        <KeyValueList
          items={[{ key: "build", label: "Build", value: "B123" }]}
        />
      </ToastProvider>,
    );

    const btn = screen.getByRole("button", { name: /Build/ });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.classList.contains("is-copied")).toBe(true);
    });
  });

  it("renders tab status dots and supports keyboard navigation in ScrollableTabs", () => {
    const onChange = vi.fn();
    render(
      <ScrollableTabs
        ariaLabel="Detail tabs"
        value="gms"
        onChange={onChange}
        tabs={[
          { id: "gms", label: "GMS", dot: "error" },
          { id: "drm", label: "DRM" },
        ]}
      />,
    );

    const gmsTab = screen.getByRole("tab", { name: "GMS" });
    expect(gmsTab.querySelector(".selftest-tab-dot.is-error")).toBeTruthy();
    gmsTab.focus();
    fireEvent.keyDown(gmsTab, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("drm");
  });
});
