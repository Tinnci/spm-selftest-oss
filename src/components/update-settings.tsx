import { Button } from "@/components/ui/button";
import type { useDesktopUpdate } from "@/hooks/useDesktopUpdate";
import { t } from "@/i18n";

export function UpdateSettings({
  update,
  collecting,
}: {
  update: ReturnType<typeof useDesktopUpdate>;
  collecting: boolean;
}) {
  const { status, availableVersion } = update;
  const waiting = status === "checking" || status === "installing";
  const restartRequired = status === "restartRequired";
  const message =
    status === "idle" && availableVersion
      ? t("settings.update.available", { version: availableVersion })
      : status !== "idle"
        ? t(`settings.update.${status}`)
        : "";

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
        <span className="quiet basis-full" role="status">
          {message}
        </span>
      </div>
    </div>
  );
}
