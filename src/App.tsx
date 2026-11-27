import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ClipboardCheck,
  ArrowDownToLine,
  Languages,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { WindowControls } from "@/components/window-controls";
import { ContextMenuProvider } from "@/components/context-menu";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SelfTestPage } from "./SelfTestPage";
import { SettingsDialog } from "./SettingsDialog";
import { WelcomeGuide } from "./components/welcome-guide";
import { desktop } from "./api/transport";
import { useDesktopUpdate } from "./hooks/useDesktopUpdate";
import { appVersion } from "./api/shell";
import {
  languagePreference,
  locale,
  setLanguage,
  t,
  type LanguagePreference,
} from "./i18n";
import { readPreferences, savePreferences } from "./preferences";
import { setTheme, themePreference, type Theme } from "./theme";

const NARROW = "(max-width: 960px)";

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia?.(NARROW).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(NARROW);
    if (!media) return;
    const change = () => setNarrow(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return narrow;
}

function RailLink({
  icon: Icon,
  label,
  current,
  collapsed,
  onClick,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  current?: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rail-link"
      aria-current={current ? "page" : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      {collapsed ? null : <span>{label}</span>}
    </button>
  );
}

export default function App() {
  useTranslation();
  const [settings, setSettings] = useState(false);
  const [view, setView] = useState<"selftest" | "guide">("selftest");
  const [currentTheme, setCurrentTheme] = useState(themePreference);
  const [preferences, setPreferences] = useState(readPreferences);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const narrow = useNarrow();
  const update = useDesktopUpdate();
  const collapsed = preferences.railCollapsed || narrow;

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

  return (
    <ContextMenuProvider>
      <TooltipProvider>
        <ToastProvider>
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
                onClick={() => setSettings(false)}
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
                  title={
                    currentTheme === "dark" ? t("theme.light") : t("theme.dark")
                  }
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
              <nav
                className="rail"
                data-collapsed={collapsed}
                aria-label={t("nav.label")}
              >
                <RailLink
                  icon={ClipboardCheck}
                  label={t("nav.selftest")}
                  current={view === "selftest"}
                  collapsed={collapsed}
                  onClick={() => setView("selftest")}
                />
                <RailLink
                  icon={BookOpen}
                  label={t("nav.guide")}
                  current={view === "guide"}
                  collapsed={collapsed}
                  onClick={() => setView("guide")}
                />
                <div className="rail-models" aria-hidden="true" />
                <div className="rail-foot">
                  <RailLink
                    icon={Settings}
                    label={t("nav.settings")}
                    collapsed={collapsed}
                    onClick={() => setSettings(true)}
                  />
                  {narrow ? null : (
                    <RailLink
                      icon={
                        preferences.railCollapsed
                          ? PanelLeftOpen
                          : PanelLeftClose
                      }
                      label={t(
                        preferences.railCollapsed
                          ? "nav.expand"
                          : "nav.collapse",
                      )}
                      collapsed={collapsed}
                      onClick={() =>
                        updatePreferences({
                          railCollapsed: !preferences.railCollapsed,
                        })
                      }
                    />
                  )}
                </div>
              </nav>
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
                  refreshKey={recordsRevision}
                />
              )}
            </div>
          </div>
        </ToastProvider>
      </TooltipProvider>
    </ContextMenuProvider>
  );
}
