import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";

type Update = { id: number; version: string };

type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "checkFailed"
  | "installing"
  | "installFailed"
  | "restartRequired";

export function useDesktopUpdate() {
  const enabled = import.meta.env.VITE_ENABLE_UPDATER === "1" && isTauri();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const busy = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    setStatus("checking");
    try {
      const available = await invoke<Update | null>("check_desktop_update");
      setUpdate(available);
      setStatus(available ? "idle" : "current");
    } catch {
      setStatus("checkFailed");
    } finally {
      busy.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  const install = async () => {
    if (!update || busy.current) return;
    busy.current = true;
    setStatus("installing");
    try {
      await invoke("install_desktop_update", { id: update.id });
      setUpdate(null);
      setStatus("restartRequired");
      await relaunch().catch(() => undefined);
    } catch {
      setStatus("installFailed");
    } finally {
      busy.current = false;
    }
  };

  return {
    enabled,
    status,
    availableVersion: update?.version,
    checkForUpdate,
    install,
  };
}
