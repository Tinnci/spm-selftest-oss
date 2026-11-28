import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelfTestRecord } from "@/api/self_test";
import { useCopyWithToast } from "@/hooks/useCopyWithToast";
import { KeyValueList } from "./key-value-list";

export function HardwarePanel({
  hardware,
}: {
  hardware: NonNullable<SelfTestRecord["hardware"]>;
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopyPre = async (key: string, text: string) => {
    const ok = await copyWithToast(text);
    if (!ok) return;
    setCopiedKey(key);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedKey(null), 1200);
  };

  const activeItems = Object.entries(hardware.active).map(([key, read]) => ({
    key: `hw-active-${key}`,
    label: t(`selftest.hardware.field.${key}`, { defaultValue: key }),
    value: read.values.length
      ? read.values.join(" · ")
      : t(`selftest.hardware.status.${read.status}`),
    title: read.source,
  }));

  const mmiItems = Object.entries(hardware.mmi).map(([key, value]) => ({
    key: `hw-mmi-${key}`,
    label: t(`selftest.hardware.field.${key}`, { defaultValue: key }),
    value: value.replaceAll("\n", " · "),
  }));

  return (
    <div
      className="selftest-drm"
      role="tabpanel"
      id="selftest-panel-hardware"
      aria-labelledby="selftest-tab-hardware"
      tabIndex={0}
    >
      {hardware.issues.map((issue) => (
        <p className="quiet" key={issue}>
          {t("selftest.hardware.issue", {
            section: t(`selftest.hardware.${issue}`),
          })}
        </p>
      ))}
      <section className="selftest-drm-section">
        <h4>{t("selftest.hardware.active")}</h4>
        <KeyValueList items={activeItems} />
      </section>
      <section className="selftest-drm-section">
        <h4>
          {t("selftest.hardware.mmi")} ·{" "}
          {t(`selftest.hardware.status.${hardware.mmi_status}`)}
        </h4>
        <KeyValueList items={mmiItems} />
      </section>
      <section className="selftest-drm-section">
        <h4>{t("selftest.hardware.inventory")}</h4>
        {Object.entries(hardware.inventory_sources).map(([group, sources]) => {
          const paths = hardware.inventory[group] ?? [];
          const sourcesText = Object.entries(sources)
            .map(
              ([path, status]) =>
                `${path} · ${t(`selftest.hardware.status.${status}`)}`,
            )
            .join("\n");
          const pathsText = paths.join("\n");
          const sourcesKey = `${group}-sources`;
          const pathsKey = `${group}-paths`;
          return (
            <details key={group}>
              <summary>
                {t(`selftest.hardware.group.${group}`)} ({paths.length})
              </summary>
              <div className="selftest-pre-wrap">
                <pre>{sourcesText}</pre>
                <button
                  type="button"
                  className={`selftest-pre-copy${copiedKey === sourcesKey ? " is-copied" : ""}`}
                  aria-label={t("selftest.ctxCopyValue")}
                  title={t("selftest.ctxCopyValue")}
                  onClick={() => void handleCopyPre(sourcesKey, sourcesText)}
                >
                  {copiedKey === sourcesKey ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <Copy size={12} aria-hidden="true" />
                  )}
                </button>
              </div>
              {paths.length ? (
                <div className="selftest-pre-wrap">
                  <pre>{pathsText}</pre>
                  <button
                    type="button"
                    className={`selftest-pre-copy${copiedKey === pathsKey ? " is-copied" : ""}`}
                    aria-label={t("selftest.ctxCopyValue")}
                    title={t("selftest.ctxCopyValue")}
                    onClick={() => void handleCopyPre(pathsKey, pathsText)}
                  >
                    {copiedKey === pathsKey ? (
                      <Check size={12} aria-hidden="true" />
                    ) : (
                      <Copy size={12} aria-hidden="true" />
                    )}
                  </button>
                </div>
              ) : null}
            </details>
          );
        })}
      </section>
    </div>
  );
}
