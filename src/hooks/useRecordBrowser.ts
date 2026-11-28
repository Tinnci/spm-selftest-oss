import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SelfTestSummary } from "@/api/self_test";
import { localDate } from "@/selftest/date";

export type FilterSnapshot = {
  recordQuery: string;
  typeFilter: string;
  resultFilter: string;
  reviewFilter: string;
};

export function useRecordBrowser(
  records: SelfTestSummary[],
  pinnedIds: string[] = [],
) {
  const { t } = useTranslation();
  const [recordQuery, setRecordQuery] = useState("");
  const deferredQuery = useDeferredValue(recordQuery);
  const [recordSort, setRecordSort] = useState<"newest" | "oldest">("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const lastSelectedIdRef = useRef<string | null>(null);

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const filteredRecords = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return records
      .filter((record) => {
        if (typeFilter !== "all" && record.test_type !== typeFilter)
          return false;
        if (resultFilter !== "all" && record.check_status !== resultFilter)
          return false;
        if (reviewFilter !== "all" && record.review_status !== reviewFilter)
          return false;
        if (!q) return true;
        return `${record.name} ${record.model} ${record.model_code} ${record.ota_version} ${record.build} ${record.serial} ${record.note} ${record.gms} ${record.patch} ${record.test_type} ${record.tags.join(" ")}`
          .toLowerCase()
          .includes(q);
      })
      .sort((left, right) => {
        const leftPinned = pinnedSet.has(left.id) ? 0 : 1;
        const rightPinned = pinnedSet.has(right.id) ? 0 : 1;
        if (leftPinned !== rightPinned) return leftPinned - rightPinned;
        return recordSort === "newest"
          ? right.collected_at.localeCompare(left.collected_at)
          : left.collected_at.localeCompare(right.collected_at);
      });
  }, [
    records,
    deferredQuery,
    typeFilter,
    resultFilter,
    reviewFilter,
    recordSort,
    pinnedSet,
  ]);

  const recordGroups = useMemo(() => {
    const shift = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return date.getFullYear() + "-" + month + "-" + day;
    };
    const today = localDate();
    const yesterday = shift(1);
    const weekAgo = shift(6);
    const pinnedItems: SelfTestSummary[] = [];
    const groups = [
      {
        key: "today",
        label: t("selftest.groupToday"),
        items: [] as SelfTestSummary[],
      },
      {
        key: "yesterday",
        label: t("selftest.groupYesterday"),
        items: [] as SelfTestSummary[],
      },
      {
        key: "week",
        label: t("selftest.groupWeek"),
        items: [] as SelfTestSummary[],
      },
      {
        key: "earlier",
        label: t("selftest.groupEarlier"),
        items: [] as SelfTestSummary[],
      },
    ];
    for (const record of filteredRecords) {
      if (pinnedSet.has(record.id)) {
        pinnedItems.push(record);
        continue;
      }
      const day = record.collected_at.slice(0, 10);
      const index =
        day === today ? 0 : day === yesterday ? 1 : day >= weekAgo ? 2 : 3;
      groups[index].items.push(record);
    }
    const nonEmpty = groups.filter((group) => group.items.length > 0);
    if (pinnedItems.length > 0) {
      return [
        {
          key: "pinned",
          label: t("selftest.groupPinned"),
          items: pinnedItems,
        },
        ...nonEmpty,
      ];
    }
    return nonEmpty;
  }, [filteredRecords, pinnedSet, t]);

  const toggleSelected = (id: string, shiftKey = false) => {
    const anchor = lastSelectedIdRef.current;
    if (shiftKey && anchor && anchor !== id) {
      const ids = filteredRecords.map((r) => r.id);
      const from = ids.indexOf(anchor);
      const to = ids.indexOf(id);
      if (from !== -1 && to !== -1) {
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        const range = ids.slice(start, end + 1);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...range])));
        lastSelectedIdRef.current = id;
        return;
      }
    }
    lastSelectedIdRef.current = id;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const visible = filteredRecords.map((record) => record.id);
    const allSelected =
      visible.length > 0 && visible.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visible);
  };

  const clearFilters = (): FilterSnapshot | null => {
    const hasActive =
      recordQuery !== "" ||
      typeFilter !== "all" ||
      resultFilter !== "all" ||
      reviewFilter !== "all";
    const snapshot: FilterSnapshot = {
      recordQuery,
      typeFilter,
      resultFilter,
      reviewFilter,
    };
    setRecordQuery("");
    setTypeFilter("all");
    setResultFilter("all");
    setReviewFilter("all");
    return hasActive ? snapshot : null;
  };

  const restoreFilters = (snapshot: FilterSnapshot) => {
    setRecordQuery(snapshot.recordQuery);
    setTypeFilter(snapshot.typeFilter);
    setResultFilter(snapshot.resultFilter);
    setReviewFilter(snapshot.reviewFilter);
  };

  return {
    recordQuery,
    setRecordQuery,
    recordSort,
    setRecordSort,
    selectedIds,
    setSelectedIds,
    typeFilter,
    setTypeFilter,
    resultFilter,
    setResultFilter,
    reviewFilter,
    setReviewFilter,
    filteredRecords,
    recordGroups,
    toggleSelected,
    toggleSelectAll,
    clearFilters,
    restoreFilters,
  };
}
