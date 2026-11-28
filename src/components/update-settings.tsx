import { FolderOpen } from "lucide-react";
import { revealPath } from "@/api/shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { useDesktopUpdate } from "@/hooks/useDesktopUpdate";
import { t } from "@/i18n";

export function UpdateSettings({
  update,
  collecting,
}: {
  update: ReturnType<typeof useDesktopUpdate>;
  collecting: boolean;
}) {
  const { status, availableVersion, portable, progress, installerPath } =
    update;
  const waiting =
    status === "checking" || status === "installing" || status === "launching";
  const restartRequired = status === "restartRequired";

  const progressText = (() => {
    if (status !== "installing") return "";
    if (!progress) return t("settings.update.installing");
    if (progress.stage === "downloading") {
      if (progress.total && progress.total > 0) {
        const percent = Math.min(
          100,
          Math.round((progress.downloaded / progress.total) * 100),
        );
        return t("settings.update.stage.downloadingPercent", { percent });
      }
      return t("settings.update.stage.downloading");
    }
    return t(`settings.update.stage.${progress.stage}`);
  })();

  const message =
    status === "installing"
      ? progressText
      : status === "idle" && availableVersion
        ? t("settings.update.available", { version: availableVersion })
        : status !== "idle"
          ? t(`settings.update.${status}`)
          : "";

  const progressValue =
    status === "installing" &&
    progress?.stage === "downloading" &&
    progress.total &&
    progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  return (
    <div className="settings-row">
      <span>{t("settings.update")}</span>
      <div className="settings-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            waiting ||
            restartRequired ||
            (Boolean(availableVersion) && collecting)
          }
          onClick={() =>
            void (availableVersion ? update.install() : update.checkForUpdate())
          }
        >
          {t(
            availableVersion
              ? "settings.update.install"
              : "settings.update.check",
          )}
        </Button>
        {status === "manualInstall" && installerPath ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void revealPath(installerPath).catch(() => {})}
          >
            <FolderOpen aria-hidden="true" />
            {t("settings.update.openInstaller")}
          </Button>
        ) : null}
        {status === "installing" ? (
          <div className="basis-full">
            <Progress value={progressValue} />
          </div>
        ) : null}
        <span className="quiet basis-full" role="status">
          {message}
        </span>
        {portable && availableVersion ? (
          <span className="quiet basis-full">
            {t("settings.update.portableHint")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
