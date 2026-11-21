import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceHeading } from "../workspace-heading";

export function SelfTestWorkspace({
  notice,
  sidebar,
  detail,
  collection,
  checks,
}: {
  notice: ReactNode;
  sidebar: ReactNode;
  detail: ReactNode;
  collection: ReactNode;
  checks: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <main
      id="main"
      className="window-scroll selftest-page"
      aria-label={t("nav.selftest")}
    >
      <div className="selftest-editor">
        <div className="selftest-content">
          <WorkspaceHeading
            title={t("nav.selftest")}
            description={t("selftest.description")}
          />
          {notice}
          <div className="selftest-workspace">
            {sidebar}
            <section className="selftest-detail">{detail}</section>
          </div>
        </div>
      </div>
      <div className="selftest-dock">
        {collection}
        {checks}
      </div>
    </main>
  );
}
