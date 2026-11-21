import { useState, type Ref } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronUp,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CheckLevel, SelfTestCheck } from "@/api/self_test";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { checkText } from "@/selftest/checks";

type CheckGroups = Record<CheckLevel, SelfTestCheck[]>;
type View = "auto" | CheckLevel;

const levels = ["error", "warn", "pass"] as const;
const checkIcons = {
  error: XCircle,
  warn: AlertTriangle,
  pass: CheckCircle2,
};

export function ChecksPanel({
  ref,
  recordId,
  groups,
  loading,
  checking,
  recheckDisabled,
  onRecheck,
  getAction,
}: {
  ref: Ref<HTMLElement>;
  recordId: string | undefined;
  groups: CheckGroups;
  loading: boolean;
  checking: boolean;
  recheckDisabled: boolean;
  onRecheck: () => void;
  getAction: (
    check: SelfTestCheck,
  ) => { label: string; run: () => void } | undefined;
}) {
  const { t } = useTranslation();
  const { error, warn, pass } = groups;
  const hasIssues = error.length + warn.length > 0;
  const hasResults = hasIssues || pass.length > 0;
  const scope = `${recordId ?? ""}:${error.length}:${warn.length}:${pass.length}`;
  const [selection, setSelection] = useState<{
    scope: string;
    view: View;
    collapsed: boolean;
  }>();
  const current = selection?.scope === scope ? selection : undefined;
  const view = current?.view ?? "auto";
  const selectView = (next: View) =>
    setSelection({ scope, view: next, collapsed: false });
  const collapse = () => setSelection({ scope, view, collapsed: true });
  const visibleLevels =
    view === "auto"
      ? levels.filter((level) => level !== "pass" && groups[level].length > 0)
      : [view];
  const expanded = !current?.collapsed && visibleLevels.length > 0;
  const changeExpanded = (open: boolean) => {
    if (open) selectView(visibleLevels.length ? view : "pass");
    else collapse();
  };
  const expandLabel = t(
    expanded ? "selftest.checksCollapse" : "selftest.checksExpand",
  );

  return (
    <section
      ref={ref}
      className="selftest-checks"
      aria-labelledby="selftest-checks-title"
      tabIndex={-1}
      onFocus={(event) => {
        if (event.target === event.currentTarget) selectView("auto");
      }}
    >
      <Collapsible.Root open={expanded} onOpenChange={changeExpanded}>
        <div className="selftest-checks-toolbar">
          <div className="selftest-checks-title">
            <h2 id="selftest-checks-title">{t("selftest.checksTitle")}</h2>
            {hasResults ? (
              <span className="sr-only" role="status">
                {checking
                  ? t("selftest.checksRunning")
                  : t("selftest.checkSummary", {
                      errors: error.length,
                      warnings: warn.length,
                    })}
              </span>
            ) : (
              <span className="selftest-checks-message" role="status">
                {t(
                  checking
                    ? "selftest.checksRunning"
                    : loading
                      ? "selftest.loadingRecords"
                      : recordId
                        ? "selftest.checksNone"
                        : "selftest.checksSelectRecord",
                )}
              </span>
            )}
          </div>
          {hasResults ? (
            <div
              className="selftest-check-filters"
              role="group"
              aria-label={t("selftest.checksFilter")}
            >
              {levels.map((level) => {
                const Icon = checkIcons[level];
                return (
                  <Button
                    key={level}
                    variant="ghost"
                    size="xs"
                    className={`selftest-check-filter is-${level}`}
                    disabled={!groups[level].length}
                    aria-controls="selftest-check-results"
                    aria-pressed={expanded && view === level}
                    onClick={() => {
                      if (!expanded || view !== level) selectView(level);
                      else if (hasIssues) selectView("auto");
                      else collapse();
                    }}
                  >
                    <Icon aria-hidden="true" />
                    {t(`selftest.checkStatus.${level}`)}{" "}
                    <span className="selftest-check-count">
                      {groups[level].length}
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : null}
          <div className="selftest-checks-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={!recordId || loading || checking || recheckDisabled}
              onClick={onRecheck}
            >
              {checking ? <Spinner /> : <RefreshCw aria-hidden="true" />}
              {t(checking ? "selftest.checksRunning" : "selftest.recheck")}
            </Button>
            {hasResults ? (
              <Collapsible.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="selftest-checks-toggle"
                  />
                }
                aria-controls="selftest-check-results"
                aria-label={expandLabel}
                title={expandLabel}
              >
                <ChevronUp aria-hidden="true" />
              </Collapsible.Trigger>
            ) : null}
          </div>
        </div>
        <Collapsible.Panel
          id="selftest-check-results"
          className="selftest-checks-disclosure"
          inert={!expanded}
          aria-hidden={expanded ? undefined : true}
          keepMounted
        >
          {visibleLevels.length ? (
            <ul
              key={`${scope}:${view}`}
              className="selftest-checks-results"
              aria-label={t("selftest.checksTitle")}
              tabIndex={0}
            >
              {visibleLevels.flatMap((level) => {
                const Icon = checkIcons[level];
                return groups[level].map((check, index) => {
                  const action = getAction(check);
                  return (
                    <li
                      key={`${level}-${check.code}-${index}`}
                      className={`selftest-check-row is-${level}`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span className="selftest-check-text">
                        <span className="sr-only">
                          {t(`selftest.checkStatus.${level}`)}{" "}
                        </span>
                        {checkText(check)}
                      </span>
                      {action ? (
                        <Button variant="ghost" size="xs" onClick={action.run}>
                          {action.label}
                          <ArrowUpRight aria-hidden="true" />
                        </Button>
                      ) : null}
                    </li>
                  );
                });
              })}
            </ul>
          ) : null}
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}
