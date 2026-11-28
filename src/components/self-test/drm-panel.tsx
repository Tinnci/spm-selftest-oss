import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DrmSection } from "@/api/self_test";
import { Badge } from "@/components/ui/badge";
import { CopyPre } from "@/components/ui/copy-pre";
import { useCopyWithToast } from "@/hooks/useCopyWithToast";

export function DrmPanel({
  facts,
  sections,
}: {
  facts: string[];
  sections: DrmSection[];
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopyFact = async (key: string, text: string) => {
    const ok = await copyWithToast(text);
    if (!ok) return;
    setCopiedKey(key);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedKey(null), 1200);
  };

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
          {facts.map((fact, idx) => {
            const key = `fact-${idx}`;
            const isCopied = copiedKey === key;
            return (
              <button
                key={idx}
                type="button"
                className="selftest-drm-fact-btn"
                title={t("selftest.ctxCopyValue")}
                onClick={() => void handleCopyFact(key, fact)}
              >
                <Badge variant="secondary">
                  {fact}
                  {isCopied ? <Check size={11} aria-hidden="true" /> : null}
                </Badge>
              </button>
            );
          })}
        </div>
      ) : null}
      {sections.map((sec) => (
        <section key={sec.name} className="selftest-drm-section">
          <h4>[{sec.name}]</h4>
          <CopyPre text={sec.lines.join("\n")} />
        </section>
      ))}
    </div>
  );
}
