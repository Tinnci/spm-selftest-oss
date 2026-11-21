import { useEffect, useState } from "react";
import {
  selfTestRun,
  type SelfTestRecord,
  type TestType,
} from "@/api/self_test";
import { desktop } from "@/api/transport";
import { localDate } from "@/selftest/date";
import { errorText } from "@/selftest/errors";
import { useAdbEnv } from "./useAdbEnv";

export function useSelfTestCollection({
  loadingRecords,
  blocked,
  onCaptured,
}: {
  loadingRecords: boolean;
  blocked: boolean;
  onCaptured: (record: SelfTestRecord, fromDialog: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    testType: "IR" as TestType,
    modelCode: "",
    otaVersion: "",
    note: "",
  });
  const adb = useAdbEnv({
    busy: collecting || loadingRecords,
    onError: setError,
  });
  const ready = adb.env?.devices.some(
    (device) => device.serial === adb.serial && device.state === "device",
  );
  const busy = collecting || adb.scanning || adb.adbBusy || adb.waiting;

  useEffect(() => {
    if (desktop()) void adb.scanEnv("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    if (!ready || busy || blocked) return;
    setCollecting(true);
    setError("");
    try {
      const record = await selfTestRun({
        ...draft,
        adbPath: adb.adbPath,
        serial: adb.serial,
        patchReference: localDate(),
        patchValidDays: 90,
      });
      setDraft((current) => ({ ...current, name: "", note: "" }));
      await onCaptured(record, open);
      setOpen(false);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setCollecting(false);
    }
  };

  return {
    adb,
    draft,
    setDraft,
    ready,
    busy,
    blocked,
    collecting,
    error,
    open,
    onOpenChange: (next: boolean) => {
      if (!collecting) setOpen(next);
    },
    run,
  };
}
