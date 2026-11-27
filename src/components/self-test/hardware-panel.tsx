import { useTranslation } from "react-i18next";
import type { SelfTestRecord } from "@/api/self_test";
import { KeyValueList } from "./key-value-list";

export function HardwarePanel({
  hardware,
}: {
  hardware: NonNullable<SelfTestRecord["hardware"]>;
}) {
  const { t } = useTranslation();

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
          return (
            <details key={group}>
              <summary>
                {t(`selftest.hardware.group.${group}`)} ({paths.length})
              </summary>
              <pre>
                {Object.entries(sources)
                  .map(
                    ([path, status]) =>
                      `${path} · ${t(`selftest.hardware.status.${status}`)}`,
                  )
                  .join("\n")}
              </pre>
              {paths.length ? <pre>{paths.join("\n")}</pre> : null}
            </details>
          );
        })}
      </section>
    </div>
  );
}
