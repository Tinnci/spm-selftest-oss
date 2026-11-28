import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ArrowDownToLine,
  Keyboard,
  Languages,
  Moon,
  Settings,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { WindowControls } from "@/components/window-controls";
import { ContextMenuProvider } from "@/components/context-menu";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SelfTestPage } from "./SelfTestPage";
import { SettingsDialog } from "./SettingsDialog";
import { WelcomeGuide } from "./components/welcome-guide";
import { importSelfTestBackup } from "./api/self_test";
import { desktop } from "./api/transport";
import { useDesktopUpdate } from "./hooks/useDesktopUpdate";
import { appVersion } from "./api/shell";
import { locale, setLanguage, t, type LanguagePreference } from "./i18n";
import { readPreferences, savePreferences } from "./preferences";
import { setTheme, themePreference, type Theme } from "./theme";

function AppShell() {
  useTranslation();
  const toast = useToast();
  const [settings, setSettings] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [view, setView] = useState<"selftest" | "guide">("selftest");
  const [currentTheme, setCurrentTheme] = useState(themePreference);
  const [preferences, setPreferences] = useState(readPreferences);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const update = useDesktopUpdate();

  const updatePreferences = useCallback(
    (changes: Parameters<typeof savePreferences>[0]) => {
      savePreferences(changes);
      setPreferences((current) => ({ ...current, ...changes }));
    },
    [],
  );

  useEffect(() => {
    void appVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  const chooseTheme = useCallback((theme: Theme) => {
    setTheme(theme);
    setCurrentTheme(theme);
  }, []);

  const chooseLanguage = useCallback((value: LanguagePreference) => {
    void setLanguage(value);
  }, []);

  const language = locale();
  const otherLanguage = language === "zh-CN" ? "en" : "zh-CN";

  const handleImportPath = useCallback(
    async (path?: string) => {
      try {
        const res = await importSelfTestBackup(language, false, path);
        if (!res) return;
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
        toast.success(message);
        setRecordsRevision((n) => n + 1);
      } catch (error) {
        toast.error(
          t("settings.backupFailed", {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [language, toast],
  );

  useEffect(() => {
    if (!desktop()) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "enter") {
            const hasZip = event.payload.paths.some((p) =>
              p.toLowerCase().endsWith(".zip"),
            );
            if (hasZip) setDropActive(true);
          } else if (event.payload.type === "leave") {
            setDropActive(false);
          } else if (event.payload.type === "drop") {
            setDropActive(false);
            const zipPath = event.payload.paths.find((p) =>
              p.toLowerCase().endsWith(".zip"),
            );
            if (zipPath) void handleImportPath(zipPath);
          }
        }),
      )
      .then((fn) => {
        if (active) unlisten = fn;
        else fn();
      })
      .catch(() => {});
    return () => {
      active = false;
      unlisten?.();
    };
  }, [handleImportPath]);

  return (
    <div className="app-shell">
      <SettingsDialog
        open={settings}
        onOpenChange={setSettings}
        theme={currentTheme}
        onTheme={chooseTheme}
        language={language}
        onLanguage={chooseLanguage}
        version={version}
        update={update}
        collecting={busy}
        recordTags={preferences.recordTags}
        xlsx={preferences.xlsx}
        onPreferencesChange={updatePreferences}
        onBackupImported={() => setRecordsRevision((n) => n + 1)}
      />

      <header className="appbar" data-tauri-drag-region>
        <button
          type="button"
          className="wordmark"
          aria-label={t("app.name")}
          onClick={() => {
            setSettings(false);
            setView("selftest");
          }}
        >
          <BrandMark busy={busy} />
          <span className="wordmark-label">{t("app.name")}</span>
        </button>
        <div className="appbar-center" data-tauri-drag-region>
          <span className="appbar-scope">{t("app.scope")}</span>
        </div>
        <div className="appbar-actions">
          {update.availableVersion ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettings(true)}
            >
              <ArrowDownToLine aria-hidden="true" />
              {t("settings.update.available", {
                version: update.availableVersion,
              })}
            </Button>
          ) : null}
          <Button
            variant={view === "guide" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("nav.guide")}
            aria-pressed={view === "guide"}
            title={t("nav.guide")}
            onClick={() =>
              setView((current) => (current === "guide" ? "selftest" : "guide"))
            }
          >
            <BookOpen aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("selftest.shortcuts.title")}
            title={t("selftest.shortcuts.title")}
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("language.switch")}
            title={t("language.switch")}
            onClick={() => chooseLanguage(otherLanguage)}
          >
            <Languages aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              currentTheme === "dark" ? t("theme.light") : t("theme.dark")
            }
            title={currentTheme === "dark" ? t("theme.light") : t("theme.dark")}
            onClick={() =>
              chooseTheme(currentTheme === "dark" ? "light" : "dark")
            }
          >
            {currentTheme === "dark" ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("nav.settings")}
            title={t("nav.settings")}
            onClick={() => setSettings(true)}
          >
            <Settings aria-hidden="true" />
          </Button>
        </div>
        {desktop() ? <WindowControls /> : null}
      </header>

      {view === "selftest" && !preferences.guideDismissed ? (
        <div
          className="welcome-strip"
          role="region"
          aria-label={t("guide.welcomeBannerLabel")}
        >
          <div className="welcome-strip-text">
            <strong>{t("guide.title")}</strong>
            <span className="quiet">{t("guide.welcomeStrip")}</span>
          </div>
          <div className="welcome-strip-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("guide")}
            >
              {t("guide.openGuide")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("guide.dismiss")}
              onClick={() => updatePreferences({ guideDismissed: true })}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="app-body">
        {view === "guide" ? (
          <div className="window-scroll">
            <main className="page-content">
              <WelcomeGuide
                onStart={() => {
                  updatePreferences({ guideDismissed: true });
                  setView("selftest");
                }}
                onOpenSettings={() => setSettings(true)}
              />
            </main>
          </div>
        ) : (
          <SelfTestPage
            onActivity={setBusy}
            recordTags={preferences.recordTags}
            xlsx={preferences.xlsx}
            pinnedIds={preferences.pinnedIds}
            lastDetailTab={preferences.lastDetailTab}
            diffChangedOnly={preferences.diffChangedOnly}
            onPreferencesChange={updatePreferences}
            shortcutsOpen={shortcutsOpen}
            onShortcutsOpenChange={setShortcutsOpen}
            onImportBackup={() => void handleImportPath()}
            refreshKey={recordsRevision}
          />
        )}
      </div>

      {dropActive ? (
        <div className="app-drop-overlay" role="status" aria-live="polite">
          <div className="app-drop-card">
            <Upload size={24} aria-hidden="true" />
            <strong>{t("settings.backupDropTitle")}</strong>
            <span className="quiet">{t("settings.backupDropHint")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ContextMenuProvider>
        <TooltipProvider>
          <AppShell />
        </TooltipProvider>
      </ContextMenuProvider>
    </ToastProvider>
  );
}
