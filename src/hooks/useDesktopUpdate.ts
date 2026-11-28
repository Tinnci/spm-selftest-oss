import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";

type Update = { id: number; version: string; portable?: boolean };

export type UpdateProgress = {
  stage: "downloading" | "verifying" | "staging" | "launching";
  downloaded: number;
  total?: number | null;
};

type InstallOutcome = {
  mode: "installer" | "inPlace";
  installerPath?: string | null;
  launched: boolean;
};

type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "checkFailed"
  | "installing"
  | "launching"
  | "manualInstall"
  | "installFailed"
  | "restartRequired";

export function useDesktopUpdate() {
  const enabled = import.meta.env.VITE_ENABLE_UPDATER === "1" && isTauri();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [installerPath, setInstallerPath] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen<UpdateProgress>("desktop-update-progress", (event) => {
      if (active) setProgress(event.payload);
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [enabled]);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    setStatus("checking");
    try {
      const available = await invoke<Update | null>("check_desktop_update");
      setUpdate(available);
      setInstallerPath(null);
      setProgress(null);
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
    setProgress(null);
    setStatus("installing");
    try {
      const outcome = await invoke<InstallOutcome | undefined>(
        "install_desktop_update",
        { id: update.id },
      );
      setUpdate(null);
      if (outcome?.mode === "installer") {
        setInstallerPath(outcome.installerPath ?? null);
        setStatus(outcome.launched ? "launching" : "manualInstall");
        return;
      }
      setStatus("restartRequired");
      await relaunch().catch(() => undefined);
    } catch {
      setProgress(null);
      setStatus("installFailed");
    } finally {
      busy.current = false;
    }
  };

  return {
    enabled,
    status,
    availableVersion: update?.version,
    portable: Boolean(update?.portable),
    progress,
    installerPath,
    checkForUpdate,
    install,
  };
}
