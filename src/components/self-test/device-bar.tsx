import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelfTestEnv } from "@/api/self_test";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function DeviceBar({
  env,
  scanning,
  adbBusy,
  onScan,
  onRestart,
}: {
  env: SelfTestEnv | null;
  scanning: boolean;
  adbBusy: boolean;
  onScan: () => void;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="settings-actions">
      <Badge
        variant={env?.adb_found ? "secondary" : "outline"}
        title={t("selftest.adbAutoRefresh")}
      >
        {env?.adb_found
          ? `${t("selftest.adbReady")} · ${env.adb_version}`
          : t("selftest.adbMissing")}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        disabled={scanning || adbBusy}
        onClick={onScan}
      >
        {scanning ? <Spinner /> : <RefreshCw aria-hidden="true" />}
        {t("selftest.refreshEnv")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={adbBusy}
        onClick={onRestart}
      >
        {adbBusy ? <Spinner /> : <RefreshCw aria-hidden="true" />}
        {t("selftest.adbRestart")}
      </Button>
    </div>
  );
}
