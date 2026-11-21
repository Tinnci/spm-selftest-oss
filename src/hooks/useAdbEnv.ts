import { useEffect, useRef, useState } from "react";
import {
  selfTestAdbRestart,
  selfTestEnv,
  selfTestWaitDevice,
  type SelfTestEnv,
} from "@/api/self_test";
import { desktop } from "@/api/transport";
import { errorText } from "@/selftest/errors";

const ENV_POLL_MS = 5000;

export function useAdbEnv({
  busy,
  onError,
}: {
  busy: boolean;
  onError: (message: string) => void;
}) {
  const [adbPath, setAdbPath] = useState("");
  const [env, setEnv] = useState<SelfTestEnv | null>(null);
  const [scanning, setScanning] = useState(false);
  const [serial, setSerial] = useState("");
  const [adbBusy, setAdbBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const applyEnv = (next: SelfTestEnv) => {
    setEnv(next);
    const ready = next.devices.filter((device) => device.state === "device");
    setSerial((current) => {
      if (!ready.length) return "";
      if (ready.length === 1) {
        return ready.some((device) => device.serial === current)
          ? current
          : ready[0].serial;
      }
      return ready.some((device) => device.serial === current) ? current : "";
    });
  };

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const pollInFlight = useRef(false);
  const silentRefresh = useRef<() => Promise<void>>(async () => {});
  silentRefresh.current = async () => {
    if (
      !desktop() ||
      pollInFlight.current ||
      busyRef.current ||
      scanning ||
      adbBusy ||
      waiting ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    pollInFlight.current = true;
    try {
      applyEnv(await selfTestEnv(adbPath));
    } catch {
    } finally {
      pollInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!desktop()) {
      setEnv({
        adb_found: false,
        adb_path: "",
        adb_version: "",
        devices: [],
        error: null,
      });
      return;
    }
    let timer: number | undefined;
    const tick = () => void silentRefresh.current();
    const start = () => {
      if (timer === undefined) timer = window.setInterval(tick, ENV_POLL_MS);
    };
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") tick();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const scanEnv = async (overridePath?: string) => {
    setScanning(true);
    onError("");
    try {
      applyEnv(await selfTestEnv(overridePath ?? adbPath));
    } catch (e) {
      onError(errorText(e));
    } finally {
      setScanning(false);
    }
  };

  const restartAdb = async () => {
    if (adbBusy) return;
    setAdbBusy(true);
    onError("");
    try {
      applyEnv(await selfTestAdbRestart(adbPath));
    } catch (e) {
      onError(errorText(e));
    } finally {
      setAdbBusy(false);
    }
  };

  const waitDevice = async () => {
    if (waiting || !serial) return;
    setWaiting(true);
    onError("");
    try {
      applyEnv(await selfTestWaitDevice(adbPath, serial, 30));
    } catch (e) {
      onError(errorText(e));
    } finally {
      setWaiting(false);
    }
  };

  return {
    adbPath,
    setAdbPath,
    env,
    scanning,
    serial,
    setSerial,
    adbBusy,
    waiting,
    applyEnv,
    scanEnv,
    restartAdb,
    waitDevice,
  };
}
