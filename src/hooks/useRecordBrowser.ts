import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SelfTestSummary } from "@/api/self_test";
import { localDate } from "@/selftest/date";

export function useRecordBrowser(records: SelfTestSummary[]) {
  const { t } = useTranslation();
  const [recordQuery, setRecordQuery] = useState("");
  const [recordSort, setRecordSort] = useState<"newest" | "oldest">("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");

  const filteredRecords = useMemo(() => {
    const q = recordQuery.trim().toLowerCase();
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
      .sort((left, right) =>
        recordSort === "newest"
          ? right.collected_at.localeCompare(left.collected_at)
          : left.collected_at.localeCompare(right.collected_at),
      );
  }, [
    records,
    recordQuery,
    typeFilter,
    resultFilter,
    reviewFilter,
    recordSort,
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
      const day = record.collected_at.slice(0, 10);
      const index =
        day === today ? 0 : day === yesterday ? 1 : day >= weekAgo ? 2 : 3;
      groups[index].items.push(record);
    }
    return groups.filter((group) => group.items.length > 0);
  }, [filteredRecords, t]);

  const toggleSelected = (id: string) => {
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

  const clearFilters = () => {
    setRecordQuery("");
    setTypeFilter("all");
    setResultFilter("all");
    setReviewFilter("all");
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
  };
}
