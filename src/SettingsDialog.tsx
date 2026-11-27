import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  Languages,
  FolderOpen,
  Heart,
  SunMoon,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { XlsxSettings } from "@/components/self-test/xlsx-settings";
import { SettingsGroup } from "@/components/settings-group";
import { UpdateSettings } from "@/components/update-settings";
import type { useDesktopUpdate } from "@/hooks/useDesktopUpdate";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  exportSelfTestBackup,
  importSelfTestBackup,
  selfTestStorage,
} from "./api/self_test";
import { openRepository, revealPath, SOURCE_REPOSITORY } from "./api/shell";
import { desktop } from "./api/transport";
import { t, type Language, type LanguagePreference } from "./i18n";
import type { Theme } from "./theme";
import {
  RECORD_TAGS,
  type RecordTagVisibility,
  type XlsxPreferences,
  type savePreferences,
} from "./preferences";

export function SettingsDialog({
  open,
  onOpenChange,
  theme,
  onTheme,
  language,
  onLanguage,
  version,
  update,
  collecting,
  recordTags,
  xlsx,
  onPreferencesChange,
  onBackupImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  language: Language;
  onLanguage: (language: LanguagePreference) => void;
  version: string;
  update: ReturnType<typeof useDesktopUpdate>;
  collecting: boolean;
  recordTags: RecordTagVisibility;
  xlsx: XlsxPreferences;
  onPreferencesChange: typeof savePreferences;
  onBackupImported?: () => void;
}) {
  const toast = useToast();
  const [storage, setStorage] = useState("");
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [backupAction, setBackupAction] = useState<"export" | "import" | null>(
    null,
  );
  const [backupOverwrite, setBackupOverwrite] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");

  async function handleExportBackup() {
    setBackupAction("export");
    setBackupStatus("");
    try {
      const res = await exportSelfTestBackup(language);
      if (res) {
        const message = t("settings.backupExported", {
          records: res.records,
          reviews: res.reviews,
          path: res.path,
        });
        setBackupStatus(message);
        toast.success(message);
      }
    } catch (error) {
      const message = t("settings.backupFailed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setBackupStatus(message);
      toast.error(message);
    } finally {
      setBackupAction(null);
    }
  }

  async function handleImportBackup() {
    setBackupAction("import");
    setBackupStatus("");
    try {
      const res = await importSelfTestBackup(language, backupOverwrite);
      if (res) {
        const message =
          res.overwritten > 0
            ? t("settings.backupImportedWithOverwrite", {
                imported: res.imported,
                overwritten: res.overwritten,
                skipped: res.skipped,
              })
            : t("settings.backupImported", {
                imported: res.imported,
                skipped: res.skipped,
              });
        setBackupStatus(message);
        toast.success(message);
        if (res.imported > 0) {
          onBackupImported?.();
        }
      }
    } catch (error) {
      const message = t("settings.backupFailed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setBackupStatus(message);
      toast.error(message);
    } finally {
      setBackupAction(null);
    }
  }

  useEffect(() => {
    if (!open) {
      setBackupStatus("");
      return;
    }
    if (!desktop()) return;
    let active = true;
    setLoadingStorage(true);
    selfTestStorage()
      .then((path) => {
        if (active) setStorage(path);
      })
      .catch(() => {
        if (active) setStorage("");
      })
      .finally(() => {
        if (active) setLoadingStorage(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog app-settings-dialog">
        <DialogHeader>
          <DialogTitle className="workspace-dialog-title">
            {t("settings.title")}
          </DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>

        {open ? (
          <div className="settings-groups">
            {update.availableVersion || update.status === "restartRequired" ? (
              <UpdateSettings update={update} collecting={collecting} />
            ) : null}
            <SettingsGroup title={t("settings.appearance")}>
              <div className="settings-row">
                <span>
                  <SunMoon aria-hidden="true" size={14} /> {t("settings.theme")}
                </span>
                <div className="settings-actions">
                  <Button
                    variant={theme === "light" ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={theme === "light"}
                    onClick={() => onTheme("light")}
                  >
                    {t("settings.theme.light")}
                  </Button>
                  <Button
                    variant={theme === "dark" ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={theme === "dark"}
                    onClick={() => onTheme("dark")}
                  >
                    {t("settings.theme.dark")}
                  </Button>
                </div>
              </div>
              <div className="settings-row">
                <span>
                  <Languages aria-hidden="true" size={14} />{" "}
                  {t("settings.language")}
                </span>
                <div className="settings-actions">
                  <Button
                    variant={language === "zh-CN" ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={language === "zh-CN"}
                    onClick={() => onLanguage("zh-CN")}
                  >
                    {t("language.zh")}
                  </Button>
                  <Button
                    variant={language === "en" ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={language === "en"}
                    onClick={() => onLanguage("en")}
                  >
                    {t("language.en")}
                  </Button>
                </div>
              </div>
            </SettingsGroup>

            <SettingsGroup title={t("settings.recordTags")}>
              <div className="settings-record-tags">
                {RECORD_TAGS.map((key) => (
                  <label className="settings-check" key={key}>
                    <input
                      type="checkbox"
                      checked={recordTags[key]}
                      onChange={(event) =>
                        onPreferencesChange({
                          recordTags: {
                            ...recordTags,
                            [key]: event.target.checked,
                          },
                        })
                      }
                    />
                    {t(`settings.recordTags.${key}`)}
                  </label>
                ))}
              </div>
            </SettingsGroup>

            <SettingsGroup title={t("settings.xlsx")}>
              <XlsxSettings
                value={xlsx}
                onSave={(value) => onPreferencesChange({ xlsx: value })}
              />
            </SettingsGroup>

            <SettingsGroup title={t("settings.data")}>
              <div className="settings-row settings-storage-row">
                <span>{t("settings.storage")}</span>
                <div className="settings-path">
                  <code>{loadingStorage ? "…" : storage || "—"}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!storage || !desktop()}
                    onClick={() => void revealPath(storage).catch(() => {})}
                  >
                    {loadingStorage ? (
                      <Spinner aria-hidden="true" />
                    ) : (
                      <FolderOpen aria-hidden="true" />
                    )}
                    {t("settings.reveal")}
                  </Button>
                </div>
              </div>
              <div className="settings-row">
                <span>{t("settings.backup")}</span>
                <div className="settings-path">
                  <div className="settings-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        backupAction !== null || collecting || !desktop()
                      }
                      onClick={() => void handleExportBackup()}
                    >
                      {backupAction === "export" ? (
                        <Spinner aria-hidden="true" />
                      ) : (
                        <Download aria-hidden="true" />
                      )}
                      {t("settings.backupExport")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        backupAction !== null || collecting || !desktop()
                      }
                      onClick={() => void handleImportBackup()}
                    >
                      {backupAction === "import" ? (
                        <Spinner aria-hidden="true" />
                      ) : (
                        <Upload aria-hidden="true" />
                      )}
                      {t("settings.backupImport")}
                    </Button>
                  </div>
                  <label className="settings-check">
                    <Checkbox
                      checked={backupOverwrite}
                      disabled={backupAction !== null || !desktop()}
                      onCheckedChange={(checked) =>
                        setBackupOverwrite(checked === true)
                      }
                    />
                    <span>{t("settings.backupOverwrite")}</span>
                  </label>
                </div>
              </div>
              {backupStatus ? (
                <p className="quiet settings-note">{backupStatus}</p>
              ) : null}
              <p className="quiet settings-note">{t("settings.shared")}</p>
            </SettingsGroup>

            <SettingsGroup title={t("settings.about")}>
              <div className="settings-row">
                <span>{t("settings.version")}</span>
                <span className="settings-version">
                  {version || "—"} · {t("app.name")}
                </span>
              </div>
              {update.enabled &&
              !update.availableVersion &&
              update.status !== "restartRequired" ? (
                <UpdateSettings update={update} collecting={collecting} />
              ) : null}
              <div className="settings-row">
                <span>{t("settings.openSource")}</span>
                <div className="settings-actions">
                  <a
                    className="settings-project-link"
                    href={SOURCE_REPOSITORY}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!desktop()) return;
                      event.preventDefault();
                      void openRepository().catch(() => {});
                    }}
                  >
                    {t("settings.repository")}
                    <ExternalLink aria-hidden="true" size={13} />
                  </a>
                  <span className="quiet">Apache-2.0</span>
                </div>
              </div>
              <p className="quiet settings-note">
                <Heart aria-hidden="true" size={13} />
                {t("settings.madeWithLove")}
              </p>
            </SettingsGroup>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("settings.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
