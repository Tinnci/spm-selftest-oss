import { useTranslation } from "react-i18next";
import { t } from "../i18n";
import { useEffect, useState } from "react";
import {
  closeWindow,
  minimizeWindow,
  onCaptionMax,
  toggleMaximizeWindow,
  watchWindow,
} from "../api/session";

export function WindowControls() {
  useTranslation();
  const [maximized, setMaximized] = useState(false);
  const [maxState, setMaxState] = useState<"" | "hover" | "pressed">("");
  useEffect(() => {
    let stop: (() => void) | undefined;
    void onCaptionMax((state) => setMaxState(state)).then((fn) => (stop = fn));
    return () => stop?.();
  }, []);
  useEffect(
    () =>
      watchWindow(setMaximized, (inactive) =>
        document.documentElement.toggleAttribute("data-inactive", inactive),
      ),
    [],
  );
  return (
    <div className="window-controls">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("controls.minimize")}
        onClick={() => void minimizeWindow()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5.5h10" />
        </svg>
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={maximized ? t("controls.restore") : t("controls.maximize")}
        className={maxState}
        onClick={() => void toggleMaximizeWindow()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          {maximized ? (
            <path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" />
          ) : (
            <path d="M.5.5h9v9h-9z" />
          )}
        </svg>
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="close"
        aria-label={t("controls.close")}
        onClick={() => void closeWindow()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M.5.5l9 9M9.5.5l-9 9" />
        </svg>
      </button>
    </div>
  );
}
