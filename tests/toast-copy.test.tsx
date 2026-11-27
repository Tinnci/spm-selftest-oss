import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
