import { useRef } from "react";
import { Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TestType } from "@/api/self_test";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { useSelfTestCollection } from "@/hooks/useSelfTestCollection";
import { TEST_TYPES } from "@/selftest/constants";
import { DeviceBar } from "./device-bar";
import { Field } from "./field";

export function CollectionDialog({
  collection,
  finalFocus,
}: {
  finalFocus: () => HTMLElement | true;
  collection: ReturnType<typeof useSelfTestCollection>;
}) {
  const { t } = useTranslation();
  const title = useRef<HTMLHeadingElement>(null);
  const device = useRef<HTMLSelectElement>(null);
  const {
    adb,
    draft,
    setDraft,
    ready,
    busy,
    blocked,
    collecting,
    error,
    open,
    onOpenChange,
    run,
  } = collection;
  const {
    adbPath,
    setAdbPath,
    env,
    scanning,
    serial,
    setSerial,
    adbBusy,
    waiting,
    scanEnv,
    restartAdb,
    waitDevice,
  } = adb;
  const deviceHint = (() => {
    if (!env) return "";
    if (!env.devices.length) return t("selftest.connectDevice");
    const selected = env.devices.find((d) => d.serial === serial);
    if (!selected || selected.state === "device") return "";
    const known = ["unauthorized", "offline", "recovery"].includes(
      selected.state,
    )
      ? selected.state
      : "unknown";
    return t(`selftest.deviceState.${known}`, { state: selected.state });
  })();

  const readyDevices = env?.devices.filter((d) => d.state === "device") ?? [];
  const selectedDevice = env?.devices.find((d) => d.serial === serial);
  const headerBadge = (() => {
    if (!env) return null;
    if (!env.adb_found) {
      return {
        tone: "outline" as const,
        label: t("selftest.adbMissing"),
      };
    }
    if (!readyDevices.length) {
      return {
        tone: "outline" as const,
        label: t("selftest.noDevices"),
      };
    }
    const label =
      selectedDevice && selectedDevice.state === "device"
        ? selectedDevice.model || selectedDevice.serial
        : `${readyDevices.length} ${t("selftest.adbReady")}`;
    return { tone: "secondary" as const, label };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="selftest-header-collect">
        {headerBadge ? (
          <Badge variant={headerBadge.tone}>{headerBadge.label}</Badge>
        ) : null}
        <DialogTrigger
          render={
            <Button
              size="sm"
              className="selftest-collect-trigger"
              disabled={collecting || blocked}
            />
          }
        >
          {collecting ? (
            <Spinner />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {t(collecting ? "selftest.running" : "selftest.newCollect")}
        </DialogTrigger>
      </div>
      <DialogContent
        className="selftest-collect-dialog"
        showCloseButton={false}
        initialFocus={(type) =>
          type === "keyboard" ? device.current : title.current
        }
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle
            ref={title}
            tabIndex={-1}
            className="workspace-dialog-title"
          >
            {t("selftest.newCollect")}
          </DialogTitle>
        </DialogHeader>
        <div className="selftest-collect-body">
          <fieldset className="selftest-collect-fields" disabled={collecting}>
            <DeviceBar
              env={env}
              scanning={scanning}
              adbBusy={adbBusy}
              onScan={() => void scanEnv()}
              onRestart={() => void restartAdb()}
            />
            <div className="selftest-collector selftest-collector-primary">
              <Field
                className="selftest-field-device"
                label={t("selftest.deviceLabel")}
              >
                <select
                  className="cal-model-select"
                  ref={device}
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                >
                  {!env?.devices.length ? (
                    <option value="">{t("selftest.noDevices")}</option>
                  ) : (
                    <>
                      {!env.devices.some((d) => d.serial === serial) ? (
                        <option value="">{t("selftest.chooseDevice")}</option>
                      ) : null}
                      {env.devices.map((d) => (
                        <option key={d.serial} value={d.serial}>
                          {d.model ? `${d.model} (${d.serial})` : d.serial} ·{" "}
                          {d.state}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </Field>
              <Field
                className="selftest-field-type"
                label={t("selftest.testType")}
              >
                <select
                  className="cal-model-select"
                  aria-label={t("selftest.testType")}
                  value={draft.testType}
                  onChange={(e) =>
                    setDraft({ ...draft, testType: e.target.value as TestType })
                  }
                >
                  {TEST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`selftest.type.${type}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="selftest-collector selftest-collector-secondary">
              <Field className="selftest-field-name" label={t("selftest.name")}>
                <Input
                  value={draft.name}
                  placeholder={t("selftest.namePlaceholder")}
                  aria-label={t("selftest.name")}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field
                className="selftest-field-short"
                label={t("selftest.modelCode")}
              >
                <Input
                  value={draft.modelCode}
                  placeholder={t("selftest.modelCode")}
                  aria-label={t("selftest.modelCode")}
                  onChange={(e) =>
                    setDraft({ ...draft, modelCode: e.target.value })
                  }
                />
              </Field>
              <Field
                className="selftest-field-short"
                label={t("selftest.otaVersion")}
              >
                <Input
                  value={draft.otaVersion}
                  placeholder={t("selftest.otaVersion")}
                  aria-label={t("selftest.otaVersion")}
                  onChange={(e) =>
                    setDraft({ ...draft, otaVersion: e.target.value })
                  }
                />
              </Field>
              <Field
                className="selftest-field-adb"
                label={t("selftest.adbPathLabel")}
              >
                <Input
                  value={adbPath}
                  placeholder={t("selftest.adbPath")}
                  onChange={(e) => setAdbPath(e.target.value)}
                />
              </Field>
              <Field className="selftest-field-note" label={t("selftest.note")}>
                <Input
                  value={draft.note}
                  placeholder={t("selftest.notePlaceholder")}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </Field>
            </div>
            {deviceHint ? (
              <div className="selftest-device-hint" role="status">
                <span>{deviceHint}</span>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!serial || waiting}
                  onClick={() => void waitDevice()}
                >
                  {waiting ? <Spinner /> : null}
                  {waiting
                    ? t("selftest.waitingDevice")
                    : t("selftest.waitDevice")}
                </Button>
              </div>
            ) : null}
          </fieldset>
          {collecting ? (
            <div className="selftest-collect-progress" role="status">
              <span className="quiet">{t("selftest.collectProgress")}</span>
              <Progress value={null} />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="cal-region-error">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="selftest-collect-footer">
          <Button
            variant="outline"
            disabled={collecting}
            onClick={() => onOpenChange(false)}
          >
            {t("selftest.cancel")}
          </Button>
          <Button
            disabled={!ready || busy || blocked}
            title={!ready ? t("selftest.runNeedsDevice") : undefined}
            onClick={() => void run()}
          >
            {collecting ? <Spinner /> : <Play aria-hidden="true" />}
            {t(collecting ? "selftest.running" : "selftest.run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
