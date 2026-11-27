import { Fragment, useId, useState } from "react";
import type { RefObject } from "react";
import {
  Download,
  GitCompare,
  Inbox,
  RefreshCw,
  SearchX,
  Smartphone,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  SelfTestExportFormat,
  SelfTestRecord,
  SelfTestSummary,
} from "@/api/self_test";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContextTarget, type ContextAction } from "@/components/context-menu";
import { TEST_TYPES } from "@/selftest/constants";
import type { RecordTagVisibility } from "@/preferences";
import {
  checkStatusLabel,
  checkStatusTone,
  checkStatusVariant,
} from "@/selftest/checks";

export type RecordGroup = {
  key: string;
  label: string;
  items: SelfTestSummary[];
};

export function RecordSidebar({
  recordTags,
  records,
  filteredRecords,
  recordGroups,
  loadingRecords,
  selectedId,
  compareId,
  detail,
  selectedIds,
  recordQuery,
  typeFilter,
  resultFilter,
  reviewFilter,
  recordSort,
  searchRef,
  setRecordQuery,
  setTypeFilter,
  setResultFilter,
  setReviewFilter,
  setRecordSort,
  setSelectedIds,
  setCompareId,
  showDiff,
  toggleSelectAll,
  toggleSelected,
  handleSelectRecord,
  refreshList,
  clearFilters,
  compareSelected,
  recordContextActions,
  handleExport,
}: {
  recordTags: RecordTagVisibility;
  records: SelfTestSummary[];
  filteredRecords: SelfTestSummary[];
  recordGroups: RecordGroup[];
  loadingRecords: boolean;
  selectedId: string | null;
  compareId: string;
  detail: SelfTestRecord | null;
  selectedIds: string[];
  recordQuery: string;
  typeFilter: string;
  resultFilter: string;
  reviewFilter: string;
  recordSort: "newest" | "oldest";
  searchRef: RefObject<HTMLInputElement | null>;
  setRecordQuery: (value: string) => void;
  setTypeFilter: (value: string) => void;
  setResultFilter: (value: string) => void;
  setReviewFilter: (value: string) => void;
  setRecordSort: (value: "newest" | "oldest") => void;
  setSelectedIds: (value: string[]) => void;
  setCompareId: (value: string) => void;
  showDiff: () => void;
  toggleSelectAll: () => void;
  toggleSelected: (id: string) => void;
  handleSelectRecord: (id: string) => void;
  refreshList: (id?: string) => void;
  clearFilters: () => void;
  compareSelected: () => void;
  recordContextActions: (record: SelfTestSummary) => ContextAction[];
  handleExport: (id: string, format: SelfTestExportFormat) => void;
}) {
  const { t } = useTranslation();
  const filtersId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = [typeFilter, resultFilter, reviewFilter].some(
    (value) => value !== "all",
  );

  return (
    <aside className="selftest-sidebar">
      <div className="selftest-sidebar-head">
        <div className="local-row">
          <strong>
            {t("selftest.records", { count: filteredRecords.length })}
          </strong>
          <div className="local-row-actions">
            {records.length ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("selftest.exportAllCsv")}
                      onClick={() => void handleExport("__all__", "csv")}
                    >
                      <Download aria-hidden="true" />
                    </Button>
                  }
                />
                <TooltipContent>{t("selftest.exportAllCsv")}</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("selftest.refreshRecords")}
                    disabled={loadingRecords}
                    onClick={() => void refreshList(selectedId ?? undefined)}
                  >
                    <RefreshCw aria-hidden="true" />
                  </Button>
                }
              />
              <TooltipContent>{t("selftest.refreshRecords")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="selftest-record-search">
          <Input
            ref={searchRef}
            value={recordQuery}
            placeholder={t("selftest.searchRecordsShort")}
            aria-label={t("selftest.searchRecords")}
            onChange={(e) => setRecordQuery(e.target.value)}
          />
          <Button
            className="selftest-filter-toggle"
            variant={hasFilters || filtersOpen ? "secondary" : "outline"}
            size="icon-sm"
            aria-label={t("selftest.filtersAndSort")}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            title={t("selftest.filtersAndSort")}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
        </div>
        <div
          id={filtersId}
          className="selftest-filters"
          data-expanded={filtersOpen}
        >
          <select
            className="cal-model-select"
            aria-label={t("selftest.filterType")}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t("selftest.allTypes")}</option>
            {TEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`selftest.type.${type}`)}
              </option>
            ))}
          </select>
          <select
            className="cal-model-select"
            aria-label={t("selftest.filterResult")}
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
          >
            <option value="all">{t("selftest.allResults")}</option>
            {["error", "warn", "pass", "unknown"].map((status) => (
              <option key={status} value={status}>
                {t(`selftest.checkStatus.${status}`)}
              </option>
            ))}
          </select>
          <select
            className="cal-model-select"
            aria-label={t("selftest.review.filter")}
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <option value="all">{t("selftest.review.filterAll")}</option>
            {["ready", "pending", "stale", "blocked"].map((state) => (
              <option key={state} value={state}>
                {t(`selftest.review.state.${state}`)}
              </option>
            ))}
          </select>
          <select
            className="cal-model-select"
            aria-label={t("selftest.sortRecords")}
            value={recordSort}
            onChange={(e) =>
              setRecordSort(e.target.value as "newest" | "oldest")
            }
          >
            <option value="newest">{t("selftest.sortNewest")}</option>
            <option value="oldest">{t("selftest.sortOldest")}</option>
          </select>
        </div>
        {filteredRecords.length ? (
          <div className="selftest-list-tools">
            <label className="selftest-select-all">
              <Checkbox
                checked={
                  filteredRecords.length > 0 &&
                  filteredRecords.every((record) =>
                    selectedIds.includes(record.id),
                  )
                }
                onCheckedChange={toggleSelectAll}
                aria-label={t("selftest.selectAll")}
              />
              <span>{t("selftest.selectAll")}</span>
            </label>
          </div>
        ) : null}
        {selectedIds.length ? (
          <div className="selftest-bulk" role="region">
            <div className="selftest-bulk-head">
              <strong>
                {t("selftest.bulkSelected", {
                  count: selectedIds.length,
                })}
              </strong>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                {t("selftest.bulkClear")}
              </Button>
            </div>
            <div className="selftest-bulk-actions">
              <Button
                size="xs"
                variant="outline"
                disabled={selectedIds.length !== 2}
                onClick={() => void compareSelected()}
              >
                <GitCompare aria-hidden="true" />
                {t("selftest.bulkCompare")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {loadingRecords ? (
        <p className="quiet selftest-loading" role="status">
          <Spinner aria-hidden="true" />
          {t("selftest.loadingRecords")}
        </p>
      ) : !filteredRecords.length ? (
        records.length ? (
          <EmptyState
            icon={SearchX}
            title={t("selftest.noMatchesTitle")}
            description={t("selftest.noMatches")}
            action={
              <Button variant="outline" size="xs" onClick={clearFilters}>
                {t("selftest.clearFilters")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title={t("selftest.emptyRecordsTitle")}
            description={t("selftest.noRecordsShort")}
          />
        )
      ) : (
        <ul className="selftest-record-list">
          {recordGroups.map((group) => (
            <Fragment key={group.key}>
              <li className="selftest-group-label" role="presentation">
                {group.label}
              </li>
              {group.items.map((rec) => (
                <li
                  key={rec.id}
                  className={`selftest-record-item${selectedId === rec.id ? " is-active" : ""}${compareId === rec.id ? " is-baseline" : ""}`}
                >
                  <ContextTarget
                    title={`${rec.model_code || rec.model} · ${rec.build}`}
                    actions={recordContextActions(rec)}
                  >
                    <div className="selftest-record-card">
                      <Checkbox
                        className="selftest-record-check"
                        checked={selectedIds.includes(rec.id)}
                        onCheckedChange={() => toggleSelected(rec.id)}
                        aria-label={t("selftest.selectRecordCheckbox")}
                      />
                      <button
                        type="button"
                        className="selftest-record-btn"
                        aria-current={
                          selectedId === rec.id ? "true" : undefined
                        }
                        onClick={() => void handleSelectRecord(rec.id)}
                      >
                        <div className="selftest-record-top">
                          <strong
                            title={rec.name || rec.model_code || rec.model}
                          >
                            <Smartphone size={13} aria-hidden="true" />
                            <span>
                              {rec.name || rec.model_code || rec.model}
                            </span>
                          </strong>
                        </div>
                        <div className="selftest-record-meta">
                          <span className="selftest-record-build">
                            {rec.test_type ? `${rec.test_type} · ` : ""}
                            {rec.build}
                          </span>
                          <time
                            className="quiet"
                            dateTime={rec.collected_at}
                            title={rec.collected_at
                              .slice(0, 19)
                              .replace("T", " ")}
                          >
                            {rec.collected_at.slice(0, 10)}
                          </time>
                        </div>
                        <div className="selftest-record-badges">
                          {recordTags.checks ? (
                            <Badge
                              variant={checkStatusVariant(rec.check_status)}
                              className={checkStatusTone(rec.check_status)}
                            >
                              {checkStatusLabel(rec.check_status)}
                              {rec.check_errors
                                ? ` ${rec.check_errors}`
                                : rec.check_warnings
                                  ? ` ${rec.check_warnings}`
                                  : ""}
                            </Badge>
                          ) : null}
                          {recordTags.soc &&
                          rec.soc_vendor &&
                          rec.soc_vendor !== "Unknown" &&
                          rec.soc_vendor !== "(not set)" ? (
                            <Badge
                              variant="outline"
                              className="selftest-badge-soc"
                            >
                              {rec.soc_vendor}
                              {rec.soc_model && rec.soc_model !== "(not set)"
                                ? ` · ${rec.soc_model}`
                                : ""}
                            </Badge>
                          ) : null}
                          {recordTags.verdict ? (
                            <Badge
                              variant={
                                rec.verdict === "pass"
                                  ? "secondary"
                                  : rec.verdict === "fail"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {t(`selftest.verdict.${rec.verdict}`)}
                            </Badge>
                          ) : null}
                          {recordTags.android ? (
                            <Badge
                              variant="outline"
                              className="selftest-badge-android"
                            >
                              Android {rec.android}
                            </Badge>
                          ) : null}
                          {recordTags.review ? (
                            <Badge
                              variant="outline"
                              className={
                                rec.review_status === "ready"
                                  ? "selftest-tone-pass"
                                  : rec.review_status === "blocked"
                                    ? "selftest-tone-error"
                                    : "selftest-tone-warn"
                              }
                            >
                              {t(
                                `selftest.review.state.${rec.review_status || "pending"}`,
                              )}
                              {rec.review_pending
                                ? " " + rec.review_pending
                                : ""}
                            </Badge>
                          ) : null}
                        </div>
                        {recordTags.tags && rec.tags.length ? (
                          <p className="selftest-record-tags">
                            {rec.tags.join(" · ")}
                          </p>
                        ) : null}
                        {rec.note ? (
                          <p className="selftest-record-note">{rec.note}</p>
                        ) : null}
                      </button>
                      {detail && detail.id !== rec.id ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                className="selftest-quick-compare"
                                aria-label={t("selftest.ctxCompareWithCurrent")}
                                onClick={() => {
                                  setCompareId(rec.id);
                                  showDiff();
                                }}
                              >
                                <GitCompare size={13} aria-hidden="true" />
                              </button>
                            }
                          />
                          <TooltipContent>
                            {t("selftest.ctxCompareWithCurrent")}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </ContextTarget>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
      )}
    </aside>
  );
}
