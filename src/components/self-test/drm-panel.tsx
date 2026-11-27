import { useTranslation } from "react-i18next";
import type { DrmSection } from "@/api/self_test";
import { Badge } from "@/components/ui/badge";

export function DrmPanel({
  facts,
  sections,
}: {
  facts: string[];
  sections: DrmSection[];
}) {
  const { t } = useTranslation();

  return (
    <div
      className="selftest-drm"
      role="tabpanel"
      id="selftest-panel-drm"
      aria-labelledby="selftest-tab-drm"
      tabIndex={0}
    >
      {!facts.length && !sections.length ? (
        <p className="quiet">{t("selftest.noDrm")}</p>
      ) : null}
      {facts.length ? (
        <div className="selftest-drm-facts">
          {facts.map((fact, idx) => (
            <Badge key={idx} variant="secondary">
              {fact}
            </Badge>
          ))}
        </div>
      ) : null}
      {sections.map((sec) => (
        <section key={sec.name} className="selftest-drm-section">
          <h4>[{sec.name}]</h4>
          <pre>{sec.lines.join("\n")}</pre>
        </section>
      ))}
    </div>
  );
}
