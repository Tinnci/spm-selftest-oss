import {
  ArrowRight,
  ClipboardCheck,
  FileSpreadsheet,
  GitCompare,
  Settings,
  Smartphone,
  Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "../i18n";

export function WelcomeGuide({
  onStart,
  onOpenSettings,
}: {
  onStart: () => void;
  onOpenSettings: () => void;
}) {
  useTranslation();

  const steps = [
    {
      num: "1",
      icon: Smartphone,
      title: t("guide.step1Title"),
      body: t("guide.step1Body"),
    },
    {
      num: "2",
      icon: ClipboardCheck,
      title: t("guide.step2Title"),
      body: t("guide.step2Body"),
    },
    {
      num: "3",
      icon: GitCompare,
      title: t("guide.step3Title"),
      body: t("guide.step3Body"),
    },
    {
      num: "4",
      icon: FileSpreadsheet,
      title: t("guide.step4Title"),
      body: t("guide.step4Body"),
    },
  ];

  const testTypes = [
    { code: "IR", desc: t("guide.type.ir") },
    { code: "MR", desc: t("guide.type.mr") },
    { code: "SMR", desc: t("guide.type.smr") },
    { code: "LR", desc: t("guide.type.lr") },
  ];

  return (
    <div className="guide-page">
      <section className="guide-hero">
        <div className="guide-hero-head">
          <div className="guide-hero-mark" aria-hidden="true">
            <BrandMark busy={false} />
          </div>
          <div>
            <h1>{t("guide.title")}</h1>
            <p className="quiet">{t("guide.subtitle")}</p>
          </div>
        </div>
        <div className="guide-hero-actions">
          <Button onClick={onStart}>
            {t("guide.startSelfTest")}
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={onOpenSettings}>
            <Settings aria-hidden="true" />
            {t("nav.settings")}
          </Button>
        </div>
      </section>

      <section aria-labelledby="selftest-guide-workflow">
        <h2 id="selftest-guide-workflow" className="guide-section-title">
          {t("guide.workflowTitle")}
        </h2>
        <div className="guide-steps">
          {steps.map(({ num, icon: Icon, title, body }) => (
            <div key={num} className="guide-step">
              <div className="guide-step-head">
                <span className="guide-step-num">{num}</span>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
              </div>
              <p className="quiet">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="selftest-guide-types">
        <h2 id="selftest-guide-types" className="guide-section-title">
          {t("guide.typesTitle")}
        </h2>
        <div className="guide-grid">
          {testTypes.map(({ code, desc }) => (
            <article key={code} className="guide-card guide-card-content">
              <div className="guide-card-head">
                <Badge variant="outline">{code}</Badge>
                <h3>{t(`guide.typeTitle.${code.toLowerCase()}`)}</h3>
              </div>
              <p className="quiet">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-tips" aria-labelledby="selftest-guide-tips">
        <div>
          <h2 id="selftest-guide-tips">{t("guide.tipsTitle")}</h2>
          <p className="quiet">{t("guide.tipsBody")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onStart}>
          <Terminal aria-hidden="true" />
          {t("guide.returnSelfTest")}
        </Button>
      </section>
    </div>
  );
}
