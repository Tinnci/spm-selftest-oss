import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { useDesktopUpdate } from "../src/hooks/useDesktopUpdate";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it("only checks automatically in builds with an update feed", async () => {
  const { unmount } = renderHook(useDesktopUpdate);
  expect(invoke).not.toHaveBeenCalled();
  unmount();

  vi.stubEnv("VITE_ENABLE_UPDATER", "1");
  vi.mocked(invoke).mockResolvedValue(null);
  const { result } = renderHook(useDesktopUpdate);
  await waitFor(() => expect(result.current.status).toBe("current"));
  expect(invoke).toHaveBeenCalledWith("check_desktop_update");
});

it("installs only when requested and offers a retry on failure", async () => {
  vi.stubEnv("VITE_ENABLE_UPDATER", "1");
  vi.mocked(invoke)
    .mockResolvedValueOnce({ id: 7, version: "0.2.0" })
    .mockRejectedValueOnce(new Error("Download interrupted"))
    .mockResolvedValueOnce(undefined);
  vi.mocked(relaunch).mockResolvedValue(undefined);
  const { result } = renderHook(useDesktopUpdate);
  await waitFor(() => expect(result.current.availableVersion).toBe("0.2.0"));
  expect(invoke).toHaveBeenCalledTimes(1);

  await act(() => result.current.install());
  expect(result.current.status).toBe("installFailed");
  expect(result.current.availableVersion).toBe("0.2.0");
  expect(relaunch).not.toHaveBeenCalled();

  await act(() => result.current.install());
  expect(result.current.status).toBe("restartRequired");
  expect(invoke).toHaveBeenLastCalledWith("install_desktop_update", { id: 7 });
  expect(relaunch).toHaveBeenCalledOnce();
});
