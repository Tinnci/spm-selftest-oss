import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  GitCompare,
  Inbox,
  LayoutGrid,
  Mail,
  MoreHorizontal,
  RefreshCw,
  SearchX,
  ShieldCheck,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmailDialog, type EmailDraft } from "@/components/email-dialog";
import { EmptyState } from "@/components/empty-state";
import { ElevatedConfirm } from "@/components/elevated-confirm";
import { ReviewDialog } from "@/components/review-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ContextTarget, type ContextAction } from "./components/context-menu";
import { SelfTestWorkspace } from "./components/self-test/workspace";
import { CollectionDialog } from "./components/self-test/collection-dialog";
import { Field } from "./components/self-test/field";
import { ChecksPanel } from "./components/self-test/checks-panel";
import { DiffPanel } from "./components/self-test/diff-panel";
import { LauncherLayoutPanel } from "./components/self-test/launcher-panel";
import { RecordSidebar } from "./components/self-test/record-sidebar";
import { useHorizontalScroll } from "./hooks/useHorizontalScroll";
import { useSelfTestCollection } from "./hooks/useSelfTestCollection";
import { copyText } from "./clipboard";
import { revealPath } from "./api/shell";
import {
  selfTestDelete,
  selfTestDiff,
  selfTestExportFile,
  selfTestGet,
  selfTestLauncherLayout,
  selfTestList,
  selfTestRecheck,
  selfTestReviewPlan,
  selfTestUpdateMeta,
  type ExportEncoding,
  type LauncherLayout,
  type SelfTestCheck,
  type SelfTestDiff,
  type SelfTestExportFormat,
  type ReviewPlan,
  type SelfTestRecord,
  type SelfTestSummary,
  type SelfTestVerdict,
  type TestType,
} from "./api/self_test";
import { desktop } from "./api/transport";
import { locale, t } from "./i18n";
import {
  DEFAULT_RECORD_TAGS,
  DEFAULT_XLSX,
  type RecordTagVisibility,
  type XlsxPreferences,
} from "./preferences";
import {
  FIELD_ORDER,
  diffMarkdown,
  pickSmartBaseline,
  recordMarkdown,
} from "./selftest/report";
import { errorText } from "./selftest/errors";
import {
  groupedChecks,
  submissionEmail,
  submissionEmailBlock,
  vendorBootBackupCheck,
} from "./selftest/checks";
import { TEST_TYPES } from "./selftest/constants";
import { localDate } from "./selftest/date";
import { useRecordBrowser } from "./hooks/useRecordBrowser";

type DetailTab =
  "gms" | "drm" | "hardware" | "packages" | "features" | "launcher" | "diff";

const CHECK_FIELD: Record<string, string> = {
  patch_format: "patch",
  patch_valid: "patch",
  patch_expired: "patch",
  patch_regression: "patch",
  patch_mr_exception: "patch",
  baseos_empty: "baseos",
  baseos_required: "baseos",
  baseos_match: "baseos",
  firstapi_lr: "firstapi",
  build_type_user: "buildtype",
  build_tags_release: "tags",
};

function splitTags(value: string): string[] {
  return value
    .split(/[,，;；]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowLeft"
          ? (current - 1 + tabs.length) % tabs.length
          : (current + 1) % tabs.length;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}

export function SelfTestPage({
  onActivity,
  recordTags = DEFAULT_RECORD_TAGS,
  xlsx = DEFAULT_XLSX,
  refreshKey = 0,
}: {
  onActivity?: (busy: boolean) => void;
  recordTags?: RecordTagVisibility;
  xlsx?: XlsxPreferences;
  refreshKey?: number;
}) {
  useTranslation();
  const toast = useToast();
  const [error, setError] = useState("");

  const [records, setRecords] = useState<SelfTestSummary[]>([]);
  const {
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
  } = useRecordBrowser(records);
  const checksRef = useRef<HTMLElement>(null);
  const recordTitleRef = useRef<HTMLHeadingElement>(null);
  const focusAfterCapture = useRef(false);
  const [capturedId, setCapturedId] = useState<string>();

  const [fieldTarget, setFieldTarget] = useState<{
    key: string;
    recordId: string;
  }>();
  const checkFieldRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SelfTestRecord | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("gms");
  const [listFilter, setListFilter] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const [editName, setEditName] = useState("");
  const [editTestType, setEditTestType] = useState<TestType>("");
  const [editTags, setEditTags] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editModelCode, setEditModelCode] = useState("");
  const [editOtaVersion, setEditOtaVersion] = useState("");
  const [editVerdict, setEditVerdict] = useState<SelfTestVerdict>("pending");
  const [editPatchReference, setEditPatchReference] = useState(localDate);
  const [editPatchValidDays, setEditPatchValidDays] = useState(90);
  const [savingMeta, setSavingMeta] = useState(false);
  const [checking, setChecking] = useState(false);
  const [liveLauncher, setLiveLauncher] = useState<LauncherLayout | null>(null);
  const [inspectingLauncher, setInspectingLauncher] = useState(false);

  const [compareId, setCompareId] = useState("");
  const [diff, setDiff] = useState<SelfTestDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffFilter, setDiffFilter] = useState("");
  const [diffScope, setDiffScope] = useState<
    "all" | "fields" | "packages" | "features" | "drm"
  >("all");
  const [metaOpen, setMetaOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailMergeId, setEmailMergeId] = useState("");
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    subject: "",
    body: "",
  });
  const [emailBusy, setEmailBusy] = useState(false);
  const [exportedPath, setExportedPath] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loadedPlan, setLoadedPlan] = useState<{
    record: SelfTestRecord;
    baselineId: string;
    plan: ReviewPlan;
  } | null>(null);
  const reviewBaselineId = compareId || detail?.baseline_id || "";
  const detailPlan =
    loadedPlan?.record === detail && loadedPlan.baselineId === reviewBaselineId
      ? loadedPlan.plan
      : null;
  const [emailGateOpen, setEmailGateOpen] = useState(false);
  const [emailGateTarget, setEmailGateTarget] = useState<SelfTestRecord | null>(
    null,
  );
  const [emailGateMergeId, setEmailGateMergeId] = useState("");
  const [emailGatePlan, setEmailGatePlan] = useState<ReviewPlan | null>(null);

  const applyDetail = (rec: SelfTestRecord | null) => {
    setDetail(
      rec ? { ...rec, checks: rec.checks ?? [], tags: rec.tags ?? [] } : null,
    );
    setEditName(rec?.name ?? "");
    setEditTestType(rec?.test_type ?? "");
    setEditTags((rec?.tags ?? []).join(", "));
    setEditNote(rec?.note ?? "");
    setEditModelCode(rec?.model_code ?? "");
    setEditOtaVersion(rec?.ota_version ?? "");
    setEditVerdict(rec?.verdict ?? "pending");
    setEditPatchReference(rec?.patch_reference || localDate());
    setEditPatchValidDays(rec?.patch_valid_days || 90);
    setMetaOpen(false);
    setCompareId(
      rec?.baseline_id && rec.baseline_id !== rec.id ? rec.baseline_id : "",
    );
  };

  const refreshList = async (selectId?: string) => {
    try {
      const list = await selfTestList();
      setRecords(list);
      const target = selectId ?? selectedId ?? list[0]?.id ?? null;
      setSelectedId(target);
      if (target) {
        const rec = await selfTestGet(target);
        applyDetail(rec);
      } else {
        applyDetail(null);
      }
      setError("");
    } catch (e) {
      if (desktop()) setError(errorText(e));
    } finally {
      setLoadingRecords(false);
    }
  };

  const collection = useSelfTestCollection({
    loadingRecords,
    blocked: savingMeta || checking,
    onCaptured: async (record, fromDialog) => {
      focusAfterCapture.current = fromDialog;
      setCapturedId(record.id);
      setExportedPath("");
      setError("");
      setListFilter("");
      applyDetail(record);
      setSelectedId(record.id);
      setDetailTab("gms");
      await refreshList(record.id);
    },
  });
  const busy = collection.busy || loadingRecords;
  const collectionFinalFocus = () => {
    if (!focusAfterCapture.current) return true;
    focusAfterCapture.current = false;
    const title = recordTitleRef.current;
    title?.scrollIntoView?.({ block: "nearest" });
    return title ?? true;
  };

  const activeLauncherLayout = liveLauncher ?? detail?.launcher_layout ?? null;
  const handleInspectLauncher = async () => {
    if (!collection.adb.serial || inspectingLauncher) return;
    setInspectingLauncher(true);
    try {
      const next = await selfTestLauncherLayout(
        collection.adb.serial,
        collection.adb.adbPath,
      );
      setLiveLauncher(next);
      toast.show(t("selftest.tab.launcher", { count: next.items.length }));
    } catch (err) {
      toast.show(errorText(err));
    } finally {
      setInspectingLauncher(false);
    }
  };

  useEffect(() => {
    onActivity?.(busy);
  }, [busy, onActivity]);

  useEffect(() => {
    if (!desktop()) {
      setLoadingRecords(false);
      return;
    }
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshKey > 0) {
      void refreshList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (
      detailTab === "diff" &&
      detail &&
      (!compareId || compareId === detail.id)
    ) {
      const smart = pickSmartBaseline(detail, records);
      if (smart) setCompareId(smart);
    }
  }, [detailTab, detail, compareId, records]);

  useEffect(() => {
    if (!detail || !compareId || compareId === detail.id) {
      setDiff(null);
      setDiffLoading(false);
      return;
    }
    let active = true;
    setDiffLoading(true);
    selfTestDiff(compareId, detail.id)
      .then((res) => {
        if (active) setDiff(res);
      })
      .catch((e) => {
        if (active) {
          setDiff(null);
          setError(errorText(e));
        }
      })
      .finally(() => {
        if (active) setDiffLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detail, compareId]);

  useEffect(() => {
    if (!detail) return;
    let active = true;
    void selfTestReviewPlan(detail.id, reviewBaselineId || null)
      .then((plan) => {
        if (active)
          setLoadedPlan({ record: detail, baselineId: reviewBaselineId, plan });
      })
      .catch(() => {
        if (active) setLoadedPlan(null);
      });
    return () => {
      active = false;
    };
  }, [detail, reviewBaselineId]);

  const openRecord = async (id: string) => {
    setSelectedId(id);
    setExportedPath("");
    setListFilter("");
    if (compareId === id) setCompareId("");
    try {
      const rec = await selfTestGet(id);
      applyDetail(rec);
      if (window.innerWidth <= 1040) {
        document
          .querySelector(".selftest-detail")
          ?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      }
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleSelectRecord = async (id: string) => {
    if (detail && id !== detail.id && metaDirty) {
      setPendingSwitch(id);
      return;
    }
    await openRecord(id);
  };

  const handleSwapDiff = async () => {
    if (!detail || !compareId || compareId === detail.id) return;
    const prevTarget = detail.id;
    const nextTarget = compareId;
    setCompareId(prevTarget);
    setSelectedId(nextTarget);
    try {
      const rec = await selfTestGet(nextTarget);
      applyDetail(rec);
      setCompareId(prevTarget);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const metaDirty =
    detail &&
    (editName !== detail.name ||
      editTestType !== detail.test_type ||
      editTags !== (detail.tags ?? []).join(", ") ||
      editNote !== detail.note ||
      editModelCode !== detail.model_code ||
      editOtaVersion !== detail.ota_version ||
      editVerdict !== detail.verdict ||
      editPatchReference !== detail.patch_reference ||
      editPatchValidDays !== detail.patch_valid_days);

  const saveMetaDraft = async (): Promise<boolean> => {
    if (!detail || savingMeta || !metaDirty) return false;
    setSavingMeta(true);
    setError("");
    try {
      const updated = await selfTestUpdateMeta({
        id: detail.id,
        note: editNote,
        name: editName,
        testType: editTestType,
        tags: splitTags(editTags),
        modelCode: editModelCode,
        otaVersion: editOtaVersion,
        verdict: editVerdict,
        patchReference: editPatchReference,
        patchValidDays: editPatchValidDays,
      });
      applyDetail(updated);
      await refreshList(updated.id);
      toast.success(t("selftest.saved"));
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveMeta = () => void saveMetaDraft();

  const handleSaveAndSwitch = async () => {
    const next = pendingSwitch;
    if (!next) return;
    setSwitching(true);
    const saved = await saveMetaDraft();
    setSwitching(false);
    if (!saved) return;
    setPendingSwitch(null);
    await openRecord(next);
  };

  const handleDiscardAndSwitch = async () => {
    const next = pendingSwitch;
    if (!next) return;
    setPendingSwitch(null);
    await openRecord(next);
  };

  const quickSetVerdict = async (
    rec: SelfTestSummary,
    verdict: SelfTestVerdict,
  ) => {
    setError("");
    try {
      const updated = await selfTestUpdateMeta({
        id: rec.id,
        note: rec.note,
        name: rec.name,
        testType: rec.test_type,
        tags: rec.tags,
        modelCode: rec.model_code,
        otaVersion: rec.ota_version,
        verdict,
        patchReference: rec.patch_reference,
        patchValidDays: rec.patch_valid_days,
      });
      if (detail?.id === updated.id) applyDetail(updated);
      await refreshList(selectedId ?? undefined);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const requestDelete = (id: string, label: string) => {
    setPendingDelete({ id, label });
  };

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return;
    const id = pendingDelete.id;
    setDeleting(true);
    setError("");
    try {
      await selfTestDelete(id);
      const remaining = records.filter((r) => r.id !== id);
      const nextId =
        selectedId === id ? (remaining[0]?.id ?? null) : selectedId;
      if (compareId === id) setCompareId("");
      setSelectedId(nextId);
      setPendingDelete(null);
      await refreshList(nextId ?? undefined);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (
    targetId: string,
    format: SelfTestExportFormat,
    encoding: ExportEncoding = "bom",
  ) => {
    setError("");
    try {
      const outPath = await selfTestExportFile(
        targetId,
        format,
        locale(),
        encoding,
        format === "xlsx"
          ? {
              filename: xlsx.filename,
              sheetNames: xlsx.sheetNames,
              fields: xlsx.fields
                .filter((field) => field.enabled)
                .map((field) => field.key),
              drmColumns: xlsx.drmColumns
                .filter((field) => field.enabled)
                .map((field) => field.key),
            }
          : undefined,
      );
      if (!outPath) return;
      setExportedPath(outPath);
      await Promise.resolve(revealPath(outPath)).catch(() => undefined);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleCopyMarkdown = async (targetRec?: SelfTestRecord) => {
    const rec = targetRec ?? detail;
    if (!rec) return;
    try {
      await copyText(recordMarkdown(rec));
      toast.success(t("selftest.copied"));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleRecheck = async () => {
    if (!detail || checking) return;
    setChecking(true);
    setError("");
    try {
      const baseline =
        compareId && compareId !== detail.id
          ? compareId
          : detail.baseline_id || null;
      const updated = await selfTestRecheck(detail.id, baseline);
      setDetail((current) =>
        current?.id === updated.id
          ? {
              ...current,
              checks: updated.checks ?? [],
              baseline_id: updated.baseline_id,
            }
          : current,
      );
      setRecords(await selfTestList());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setChecking(false);
    }
  };

  const buildEmailDraft = async (record: SelfTestRecord, mergeId?: string) => {
    setEmailBusy(true);
    setError("");
    try {
      const baselineId =
        record.id === detail?.id && compareId && compareId !== record.id
          ? compareId
          : record.baseline_id;
      const baseline = baselineId
        ? await selfTestGet(baselineId).catch(() => null)
        : null;
      const comparison =
        baseline && baseline.id !== record.id
          ? await selfTestDiff(baseline.id, record.id).catch(() => null)
          : null;
      const text = submissionEmail(record, baseline, comparison);
      const [subject, ...rest] = text.split("\n");
      setEmailDraft({
        subject: subject.trim(),
        body: rest.join("\n").replace(/^\n+/, ""),
      });
      setEmailMergeId(mergeId ?? "");
      setEmailOpen(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setEmailBusy(false);
    }
  };

  const openEmailDialog = async (target?: SelfTestRecord, mergeId?: string) => {
    const record = target ?? detail;
    if (!record || emailBusy) return;
    setError("");
    try {
      const baselineId =
        record.id === detail?.id && compareId && compareId !== record.id
          ? compareId
          : record.baseline_id;
      const plan = await selfTestReviewPlan(record.id, baselineId || null);
      const merge = mergeId
        ? await selfTestGet(mergeId).catch(() => null)
        : null;
      const mergePlan = merge
        ? await selfTestReviewPlan(merge.id, merge.baseline_id || null)
        : null;
      const blockedPlan = !plan.ready
        ? plan
        : mergePlan && !mergePlan.ready
          ? mergePlan
          : null;
      if (blockedPlan) {
        const blockedRecord = blockedPlan === plan ? record : merge;
        if (!blockedRecord) return;
        if (blockedRecord.checks.some((check) => check.level === "error")) {
          if (blockedRecord.id !== detail?.id) {
            await openRecord(blockedRecord.id);
          }
          checksRef.current?.focus();
          toast.error(t("selftest.review.errorsBlock"), {
            description: t("selftest.review.errorsBlockHint"),
            timeout: 7000,
          });
          return;
        }
        if (blockedRecord.id !== detail?.id) {
          await openRecord(blockedRecord.id);
        }
        setReviewOpen(true);
        toast.warning(
          t("selftest.review.emailBlocked", {
            count: blockedPlan.counts.pending,
          }),
          {
            description: blockedRecord.name || blockedRecord.id,
            action: {
              label: t("selftest.review.open"),
              onClick: () => setReviewOpen(true),
            },
            timeout: 8000,
            priority: "high",
          },
        );
        return;
      }
      setEmailGateTarget(record);
      setEmailGateMergeId(mergeId ?? "");
      setEmailGatePlan(plan);
      setEmailGateOpen(true);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const confirmEmail = async () => {
    const record = emailGateTarget;
    if (!record) return;
    setEmailGateOpen(false);
    await buildEmailDraft(record, emailGateMergeId || undefined);
    setEmailGateTarget(null);
    setEmailGateMergeId("");
    setEmailGatePlan(null);
  };

  const handleCopyDiffMarkdown = async () => {
    if (!detail || !diff) return;
    try {
      await copyText(diffMarkdown(detail, diff, records));
      toast.success(t("selftest.copied"));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const openBatchEmail = async () => {
    if (emailBusy || !selectedIds.length) return;
    const primary = await selfTestGet(selectedIds[0]).catch(() => null);
    if (!primary) return;
    await openEmailDialog(primary, selectedIds[1]);
  };

  const compareSelected = async () => {
    if (selectedIds.length !== 2) return;
    await handleSelectRecord(selectedIds[0]);
    setCompareId(selectedIds[1]);
    setDetailTab("diff");
  };

  const recordContextActions = (rec: SelfTestSummary): ContextAction[] => {
    const actions: ContextAction[] = [
      {
        id: "open",
        label: t("selftest.ctxOpen"),
        icon: FileText,
        run: () => handleSelectRecord(rec.id),
      },
      ...(detail && detail.id !== rec.id
        ? [
            {
              id: "compare-current",
              label: t("selftest.ctxCompareWithCurrent"),
              icon: GitCompare,
              run: () => {
                setCompareId(rec.id);
                setDetailTab("diff");
              },
            },
          ]
        : [
            {
              id: "set-baseline",
              label: t("selftest.ctxSetBaseline"),
              icon: GitCompare,
              run: () => setCompareId(rec.id),
            },
          ]),
      {
        id: "verdict-pass",
        label: t("selftest.ctxVerdictPass"),
        icon: CheckCircle2,
        separator: true,
        run: () => quickSetVerdict(rec, "pass"),
      },
      {
        id: "verdict-fail",
        label: t("selftest.ctxVerdictFail"),
        icon: XCircle,
        run: () => quickSetVerdict(rec, "fail"),
      },
      {
        id: "verdict-pending",
        label: t("selftest.ctxVerdictPending"),
        run: () => quickSetVerdict(rec, "pending"),
      },
      {
        id: "copy-build",
        label: t("selftest.ctxCopyBuild", { build: rec.build }),
        icon: Copy,
        separator: true,
        run: () => copyText(rec.build),
      },
      {
        id: "copy-md",
        label: t("selftest.copyMarkdown"),
        icon: Copy,
        run: async () => {
          const full = await selfTestGet(rec.id);
          await handleCopyMarkdown(full);
        },
      },
      {
        id: "export-md",
        label: t("selftest.exportMd"),
        icon: Download,
        separator: true,
        run: () => handleExport(rec.id, "markdown"),
      },
      {
        id: "export-json",
        label: t("selftest.exportJson"),
        icon: Download,
        run: () => handleExport(rec.id, "json"),
      },
      {
        id: "export-xlsx",
        label: t("selftest.exportXlsx"),
        icon: Download,
        run: () => handleExport(rec.id, "xlsx"),
      },
      {
        id: "export-txt4",
        label: t("selftest.exportTxt4"),
        icon: Download,
        run: () => handleExport(rec.id, "txt4"),
      },
      {
        id: "delete",
        label: t("selftest.delete"),
        icon: Trash2,
        separator: true,
        run: () =>
          requestDelete(
            rec.id,
            `${rec.model_code || rec.model} · ${rec.build}`,
          ),
      },
    ];
    return actions;
  };

  const backupCheck =
    detail && detailPlan
      ? vendorBootBackupCheck(detailPlan, detail.test_type)
      : undefined;
  const checkGroups = groupedChecks(detail?.checks ?? []);
  if (backupCheck) checkGroups.warn.unshift(backupCheck);
  const baselineSummary = detail?.baseline_id
    ? records.find((record) => record.id === detail.baseline_id)
    : undefined;
  const baselineRecord = compareId
    ? records.find((record) => record.id === compareId)
    : undefined;

  const filteredPackages = useMemo(() => {
    if (!detail) return [];
    const q = listFilter.trim().toLowerCase();
    return q
      ? detail.packages.filter((p) => p.toLowerCase().includes(q))
      : detail.packages;
  }, [detail, listFilter]);

  const filteredFeatures = useMemo(() => {
    if (!detail) return [];
    const q = listFilter.trim().toLowerCase();
    return q
      ? detail.features.filter((f) => f.toLowerCase().includes(q))
      : detail.features;
  }, [detail, listFilter]);

  const compareCandidates = useMemo(() => {
    const model = detail?.model_code || detail?.fields.model || "";
    return records
      .filter((record) => record.id !== detail?.id)
      .sort((left, right) => {
        const leftSame = (left.model_code || left.model) === model ? 0 : 1;
        const rightSame = (right.model_code || right.model) === model ? 0 : 1;
        if (leftSame !== rightSame) return leftSame - rightSame;
        return right.collected_at.localeCompare(left.collected_at);
      });
  }, [records, detail]);

  const diffCounts = diff
    ? {
        fields: diff.field_changes.length,
        packages: diff.packages_added.length + diff.packages_removed.length,
        features: diff.features_added.length + diff.features_removed.length,
        drm: diff.drm_facts_added.length + diff.drm_facts_removed.length,
      }
    : { fields: 0, packages: 0, features: 0, drm: 0 };
  const diffTotal =
    diffCounts.fields +
    diffCounts.packages +
    diffCounts.features +
    diffCounts.drm;

  const diffTerm = diffFilter.trim().toLowerCase();
  const shownFieldChanges = useMemo(
    () =>
      !diff
        ? []
        : !diffTerm
          ? diff.field_changes
          : diff.field_changes.filter((c) =>
              `${t(`selftest.field.${c.key}`)} ${c.key} ${c.left} ${c.right}`
                .toLowerCase()
                .includes(diffTerm),
            ),
    [diff, diffTerm],
  );
  const shownDrmAdded = useMemo(
    () =>
      (diff?.drm_facts_added ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownDrmRemoved = useMemo(
    () =>
      (diff?.drm_facts_removed ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownPkgsAdded = useMemo(
    () =>
      (diff?.packages_added ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownPkgsRemoved = useMemo(
    () =>
      (diff?.packages_removed ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownFeatsAdded = useMemo(
    () =>
      (diff?.features_added ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownFeatsRemoved = useMemo(
    () =>
      (diff?.features_removed ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownPkgsSame = useMemo(
    () =>
      (diff?.packages_same ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );
  const shownFeatsSame = useMemo(
    () =>
      (diff?.features_same ?? []).filter(
        (x) => !diffTerm || x.toLowerCase().includes(diffTerm),
      ),
    [diff, diffTerm],
  );

  const checkField = (check: SelfTestCheck) => {
    const key = check.params?.field || CHECK_FIELD[check.code];
    return FIELD_ORDER.find((field) => field === key);
  };

  const jumpToCheck = (check: SelfTestCheck) => {
    const key = checkField(check);
    if (!key || !detail) return;
    setDetailTab("gms");
    setFieldTarget({ key, recordId: detail.id });
  };

  useEffect(() => {
    if (!fieldTarget || !checkFieldRef.current) return;
    const row = checkFieldRef.current;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    row.focus({ preventScroll: true });
    row.scrollIntoView?.({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    const timeout = window.setTimeout(() => setFieldTarget(undefined), 2400);
    return () => window.clearTimeout(timeout);
  }, [fieldTarget]);

  const tabsRef = useHorizontalScroll<HTMLDivElement>();

  useEffect(() => {
    const activeTab = tabsRef.current?.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!activeTab) return;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    activeTab.scrollIntoView?.({
      inline: "nearest",
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [detailTab, detail?.id, tabsRef]);

  const actionRef = useRef({
    run: collection.run,
    select: handleSelectRecord,
    clear: clearFilters,
  });
  actionRef.current = {
    run: collection.run,
    select: handleSelectRecord,
    clear: clearFilters,
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (meta && event.key === "Enter") {
        event.preventDefault();
        void actionRef.current.run();
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (
        typing ||
        target?.closest(
          '[role="dialog"], .selftest-checks, .selftest-detail [role="tabpanel"]',
        )
      )
        return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!filteredRecords.length) return;
        event.preventDefault();
        const index = filteredRecords.findIndex(
          (record) => record.id === selectedId,
        );
        const nextIndex =
          event.key === "ArrowDown"
            ? Math.min(index + 1, filteredRecords.length - 1)
            : Math.max(index - 1, 0);
        const next = filteredRecords[Math.max(nextIndex, 0)];
        if (next && next.id !== selectedId)
          void actionRef.current.select(next.id);
      }
      if (event.key === "Escape") actionRef.current.clear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredRecords, selectedId]);

  const sidebar = (
    <RecordSidebar
      recordTags={recordTags}
      records={records}
      filteredRecords={filteredRecords}
      recordGroups={recordGroups}
      loadingRecords={loadingRecords}
      selectedId={selectedId}
      compareId={compareId}
      detail={detail}
      selectedIds={selectedIds}
      recordQuery={recordQuery}
      typeFilter={typeFilter}
      resultFilter={resultFilter}
      reviewFilter={reviewFilter}
      recordSort={recordSort}
      searchRef={searchRef}
      setRecordQuery={setRecordQuery}
      setTypeFilter={setTypeFilter}
      setResultFilter={setResultFilter}
      setReviewFilter={setReviewFilter}
      setRecordSort={setRecordSort}
      setSelectedIds={setSelectedIds}
      setCompareId={setCompareId}
      showDiff={() => setDetailTab("diff")}
      toggleSelectAll={toggleSelectAll}
      toggleSelected={toggleSelected}
      handleSelectRecord={(id) => void handleSelectRecord(id)}
      refreshList={(id) => void refreshList(id)}
      clearFilters={clearFilters}
      openBatchEmail={() => void openBatchEmail()}
      compareSelected={() => void compareSelected()}
      recordContextActions={recordContextActions}
      handleExport={(id, format) => void handleExport(id, format)}
    />
  );
  const recordDetail = (
    <>
      {loadingRecords && !detail ? (
        <p className="quiet selftest-loading" role="status">
          <Spinner aria-hidden="true" />
          {t("selftest.loadingRecords")}
        </p>
      ) : !detail ? (
        <div className="selftest-empty-detail">
          <EmptyState
            icon={ClipboardCheck}
            title={t("selftest.emptyDetailTitle")}
            description={t("selftest.selectRecord")}
            steps={
              records.length ? undefined : (
                <ol className="selftest-empty-steps">
                  <li>{t("selftest.emptyStepConnect")}</li>
                  <li>{t("selftest.emptyStepCapture")}</li>
                  <li>{t("selftest.emptyStepReview")}</li>
                </ol>
              )
            }
          />
        </div>
      ) : (
        <>
          <header className="selftest-detail-header">
            <div>
              <h2 ref={recordTitleRef} tabIndex={-1}>
                {detail.name ||
                  `${detail.fields.model} · ${detail.fields.build}`}
              </h2>
              <p className="quiet">
                {detail.test_type ? `${detail.test_type} · ` : ""}
                {detail.fields.model} · {detail.fields.build} · {detail.serial}{" "}
                · {detail.collected_at.slice(0, 19).replace("T", " ")}
              </p>
              <div className="selftest-detail-checks">
                {capturedId === detail.id ? (
                  <span className="selftest-captured-status" role="status">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    {t("selftest.captureSaved")}
                  </span>
                ) : null}

                {detail.fields.soc_vendor &&
                detail.fields.soc_vendor !== "Unknown" &&
                detail.fields.soc_vendor !== "(not set)" ? (
                  <Badge variant="secondary">
                    {detail.fields.soc_vendor}
                    {detail.fields.soc_model &&
                    detail.fields.soc_model !== "(not set)"
                      ? ` · ${detail.fields.soc_model}`
                      : ""}
                  </Badge>
                ) : null}
                {baselineSummary ? (
                  <span className="quiet">
                    {t("selftest.autoBaseline", {
                      name: baselineSummary.name || baselineSummary.id,
                    })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="settings-actions">
              <Button
                variant={detailPlan?.ready ? "outline" : "secondary"}
                size="sm"
                onClick={() => setReviewOpen(true)}
              >
                <ShieldCheck aria-hidden="true" />
                {t("selftest.review.open")}
                {detailPlan
                  ? ` ${detailPlan.counts.confirmed + detailPlan.counts.waived}/${detailPlan.counts.required}`
                  : null}
              </Button>
              {checkGroups.error.length ? (
                <Button size="sm" onClick={() => checksRef.current?.focus()}>
                  <AlertTriangle aria-hidden="true" />
                  {t("selftest.reviewIssues")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={emailBusy}
                  onClick={() => void openEmailDialog()}
                >
                  {emailBusy ? (
                    <Spinner aria-hidden="true" />
                  ) : (
                    <Mail aria-hidden="true" />
                  )}
                  {t("selftest.prepareEmail")}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      <Download aria-hidden="true" />
                      {t("selftest.exportMenu")}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => void handleExport(detail.id, "markdown")}
                  >
                    {t("selftest.exportMd")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleExport(detail.id, "json")}
                  >
                    {t("selftest.exportJson")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleExport(detail.id, "xlsx")}
                  >
                    {t("selftest.exportXlsx")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleExport(detail.id, "csv")}
                  >
                    {t("selftest.exportCsv")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(
                    [
                      ["bom", "selftest.encodingBom"],
                      ["utf8", "selftest.encodingUtf8"],
                      ["gbk", "selftest.encodingGbk"],
                    ] as const
                  ).map(([encoding, label]) => (
                    <DropdownMenuItem
                      key={encoding}
                      onClick={() =>
                        void handleExport(detail.id, "txt4", encoding)
                      }
                    >
                      {t("selftest.exportTxt4")} · {t(label)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("selftest.moreActions")}
                      title={t("selftest.moreActions")}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleCopyMarkdown()}>
                    <Copy aria-hidden="true" />
                    {t("selftest.copyMarkdown")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void openEmailDialog()}>
                    <Mail aria-hidden="true" />
                    {t("selftest.copyEmail")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      requestDelete(
                        detail.id,
                        `${detail.model_code || detail.fields.model} · ${detail.fields.build}`,
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                    {t("selftest.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {exportedPath ? (
            <p className="quiet" role="status">
              {t("selftest.exported", { path: exportedPath })}
            </p>
          ) : null}

          <div className="selftest-meta-toggle">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={metaOpen}
              onClick={() => setMetaOpen((open) => !open)}
            >
              <ChevronDown
                className={metaOpen ? "is-open" : ""}
                aria-hidden="true"
              />
              {t("selftest.recordInfo")}
            </Button>
            <span className="quiet">
              {detail.test_type || "-"} ·{" "}
              {t(`selftest.verdict.${detail.verdict}`)}
            </span>
            {metaDirty ? (
              <span className="selftest-unsaved">{t("selftest.unsaved")}</span>
            ) : null}
          </div>

          {metaOpen ? (
            <div className="selftest-meta-bar">
              <div className="selftest-meta-row">
                <Field
                  className="selftest-field-name"
                  label={t("selftest.name")}
                >
                  <Input
                    aria-label={t("selftest.name")}
                    value={editName}
                    placeholder={t("selftest.namePlaceholder")}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </Field>
                <Field
                  className="selftest-field-type"
                  label={t("selftest.testType")}
                >
                  <select
                    className="cal-model-select"
                    aria-label={t("selftest.testType")}
                    value={editTestType}
                    onChange={(e) =>
                      setEditTestType(e.target.value as TestType)
                    }
                  >
                    <option value="">{t("selftest.type.NONE")}</option>
                    {TEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`selftest.type.${type}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  className="selftest-field-verdict"
                  label={t("selftest.verdictLabel")}
                >
                  <select
                    className="cal-model-select"
                    aria-label={t("selftest.verdictLabel")}
                    value={editVerdict}
                    onChange={(e) =>
                      setEditVerdict(e.target.value as SelfTestVerdict)
                    }
                  >
                    <option value="pending">
                      {t("selftest.verdict.pending")}
                    </option>
                    <option value="pass">{t("selftest.verdict.pass")}</option>
                    <option value="fail">{t("selftest.verdict.fail")}</option>
                  </select>
                </Field>
              </div>
              <div className="selftest-meta-row">
                <Field
                  className="selftest-field-tags"
                  label={t("selftest.tags")}
                >
                  <Input
                    aria-label={t("selftest.tags")}
                    value={editTags}
                    placeholder={t("selftest.tagsPlaceholder")}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </Field>
                <Field
                  className="selftest-field-date"
                  label={t("selftest.patchReference")}
                >
                  <Input
                    type="date"
                    aria-label={t("selftest.patchReference")}
                    value={editPatchReference}
                    onChange={(e) => setEditPatchReference(e.target.value)}
                  />
                </Field>
                <Field
                  className="selftest-field-days"
                  label={t("selftest.patchValidDays")}
                >
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    aria-label={t("selftest.patchValidDays")}
                    value={editPatchValidDays}
                    onChange={(e) =>
                      setEditPatchValidDays(Number(e.target.value) || 0)
                    }
                  />
                </Field>
              </div>
              <div className="selftest-meta-row">
                <Field
                  className="selftest-field-short"
                  label={t("selftest.modelCode")}
                >
                  <Input
                    aria-label={t("selftest.modelCode")}
                    value={editModelCode}
                    placeholder={t("selftest.modelCode")}
                    onChange={(e) => setEditModelCode(e.target.value)}
                  />
                </Field>
                <Field
                  className="selftest-field-short"
                  label={t("selftest.otaVersion")}
                >
                  <Input
                    aria-label={t("selftest.otaVersion")}
                    value={editOtaVersion}
                    placeholder={t("selftest.otaVersion")}
                    onChange={(e) => setEditOtaVersion(e.target.value)}
                  />
                </Field>
                <Field
                  className="selftest-field-note"
                  label={t("selftest.note")}
                >
                  <Input
                    aria-label={t("selftest.note")}
                    value={editNote}
                    placeholder={t("selftest.notePlaceholder")}
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                </Field>
                <div className="selftest-field selftest-field-submit">
                  <span
                    className="selftest-field-label selftest-unsaved"
                    aria-live="polite"
                  >
                    {metaDirty ? t("selftest.unsaved") : "\u00a0"}
                  </span>
                  <Button
                    variant={metaDirty ? "default" : "outline"}
                    disabled={savingMeta || !metaDirty}
                    onClick={() => void handleSaveMeta()}
                  >
                    {savingMeta ? <Spinner aria-hidden="true" /> : null}
                    {t("selftest.saveNote")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={tabsRef}
            className="selftest-tabs"
            role="tablist"
            aria-label={t("selftest.detailTabs")}
            tabIndex={-1}
            onKeyDown={moveTabFocus}
          >
            <button
              type="button"
              role="tab"
              id="selftest-tab-gms"
              aria-controls="selftest-panel-gms"
              aria-selected={detailTab === "gms"}
              tabIndex={detailTab === "gms" ? 0 : -1}
              className={detailTab === "gms" ? "is-active" : ""}
              onClick={() => setDetailTab("gms")}
            >
              {t("selftest.tab.gms")}
            </button>
            <button
              type="button"
              role="tab"
              id="selftest-tab-drm"
              aria-controls="selftest-panel-drm"
              aria-selected={detailTab === "drm"}
              tabIndex={detailTab === "drm" ? 0 : -1}
              className={detailTab === "drm" ? "is-active" : ""}
              onClick={() => setDetailTab("drm")}
            >
              {t("selftest.tab.drm")}
            </button>
            {detail.hardware ? (
              <button
                type="button"
                role="tab"
                id="selftest-tab-hardware"
                aria-controls="selftest-panel-hardware"
                aria-selected={detailTab === "hardware"}
                tabIndex={detailTab === "hardware" ? 0 : -1}
                className={detailTab === "hardware" ? "is-active" : ""}
                onClick={() => setDetailTab("hardware")}
              >
                {t("selftest.hardware.tab")}
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              id="selftest-tab-packages"
              aria-controls="selftest-panel-packages"
              aria-selected={detailTab === "packages"}
              tabIndex={detailTab === "packages" ? 0 : -1}
              className={detailTab === "packages" ? "is-active" : ""}
              onClick={() => setDetailTab("packages")}
            >
              {t("selftest.tab.packages", {
                count: detail.packages.length,
              })}
            </button>
            <button
              type="button"
              role="tab"
              id="selftest-tab-features"
              aria-controls="selftest-panel-features"
              aria-selected={detailTab === "features"}
              tabIndex={detailTab === "features" ? 0 : -1}
              className={detailTab === "features" ? "is-active" : ""}
              onClick={() => setDetailTab("features")}
            >
              {t("selftest.tab.features", {
                count: detail.features.length,
              })}
            </button>
            <button
              type="button"
              role="tab"
              id="selftest-tab-launcher"
              aria-controls="selftest-panel-launcher"
              aria-selected={detailTab === "launcher"}
              tabIndex={detailTab === "launcher" ? 0 : -1}
              className={detailTab === "launcher" ? "is-active" : ""}
              onClick={() => setDetailTab("launcher")}
            >
              <LayoutGrid size={13} aria-hidden="true" />
              {t("selftest.tab.launcher", {
                count: activeLauncherLayout?.items.length ?? 0,
              })}
            </button>
            {records.length > 1 ? (
              <button
                type="button"
                role="tab"
                id="selftest-tab-diff"
                aria-controls="selftest-panel-diff"
                aria-selected={detailTab === "diff"}
                tabIndex={detailTab === "diff" ? 0 : -1}
                className={detailTab === "diff" ? "is-active" : ""}
                onClick={() => setDetailTab("diff")}
              >
                <GitCompare size={13} aria-hidden="true" />
                {t("selftest.tab.diff")}
              </button>
            ) : null}
          </div>

          {detailTab === "gms" ? (
            <dl
              className="selftest-fields"
              role="tabpanel"
              id="selftest-panel-gms"
              aria-labelledby="selftest-tab-gms"
              tabIndex={0}
            >
              {FIELD_ORDER.map((key) => {
                const label = t(`selftest.field.${key}`);
                const value = detail.fields[key] ?? "(not set)";
                const highlighted =
                  fieldTarget?.key === key &&
                  fieldTarget.recordId === detail.id;
                return (
                  <ContextTarget
                    key={key}
                    title={label}
                    actions={[
                      {
                        id: "copy-val",
                        label: t("selftest.ctxCopyValue"),
                        icon: Copy,
                        run: () => copyText(value),
                      },
                      {
                        id: "copy-pair",
                        label: t("selftest.ctxCopyPair"),
                        icon: Copy,
                        run: () => copyText(`${label}: ${value}`),
                      },
                    ]}
                  >
                    <div
                      className={`selftest-field-row${highlighted ? " is-highlight" : ""}`}
                      ref={highlighted ? checkFieldRef : undefined}
                      tabIndex={highlighted ? -1 : undefined}
                      data-field={key}
                    >
                      <dt>{label}</dt>
                      <dd>
                        <span>{value}</span>
                        <button
                          type="button"
                          className="selftest-copy-value"
                          aria-label={`${t("selftest.ctxCopyValue")} ${label}`}
                          title={t("selftest.ctxCopyValue")}
                          onClick={() => void copyText(value)}
                        >
                          <Copy size={11} aria-hidden="true" />
                        </button>
                      </dd>
                    </div>
                  </ContextTarget>
                );
              })}
            </dl>
          ) : null}

          {detailTab === "drm" ? (
            <div
              className="selftest-drm"
              role="tabpanel"
              id="selftest-panel-drm"
              aria-labelledby="selftest-tab-drm"
              tabIndex={0}
            >
              {!detail.drm_facts.length && !detail.drm_sections.length ? (
                <p className="quiet">{t("selftest.noDrm")}</p>
              ) : null}
              {detail.drm_facts.length ? (
                <div className="selftest-drm-facts">
                  {detail.drm_facts.map((fact, idx) => (
                    <Badge key={idx} variant="secondary">
                      {fact}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {detail.drm_sections.map((sec) => (
                <section key={sec.name} className="selftest-drm-section">
                  <h4>[{sec.name}]</h4>
                  <pre>{sec.lines.join("\n")}</pre>
                </section>
              ))}
            </div>
          ) : null}

          {detailTab === "hardware" && detail.hardware ? (
            <div
              className="selftest-drm"
              role="tabpanel"
              id="selftest-panel-hardware"
              aria-labelledby="selftest-tab-hardware"
              tabIndex={0}
            >
              {detail.hardware.issues.map((issue) => (
                <p className="quiet" key={issue}>
                  {t("selftest.hardware.issue", {
                    section: t(`selftest.hardware.${issue}`),
                  })}
                </p>
              ))}
              <section className="selftest-drm-section">
                <h4>{t("selftest.hardware.active")}</h4>
                <dl className="selftest-fields">
                  {Object.entries(detail.hardware.active).map(([key, read]) => (
                    <div className="selftest-field-row" key={key}>
                      <dt>
                        {t(`selftest.hardware.field.${key}`, {
                          defaultValue: key,
                        })}
                      </dt>
                      <dd>
                        <span title={read.source}>
                          {read.values.length
                            ? read.values.join(" · ")
                            : t(`selftest.hardware.status.${read.status}`)}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="selftest-drm-section">
                <h4>
                  {t("selftest.hardware.mmi")} ·{" "}
                  {t(`selftest.hardware.status.${detail.hardware.mmi_status}`)}
                </h4>
                <dl className="selftest-fields">
                  {Object.entries(detail.hardware.mmi).map(([key, value]) => (
                    <div className="selftest-field-row" key={key}>
                      <dt>
                        {t(`selftest.hardware.field.${key}`, {
                          defaultValue: key,
                        })}
                      </dt>
                      <dd>
                        <span>{value.replaceAll("\n", " · ")}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="selftest-drm-section">
                <h4>{t("selftest.hardware.inventory")}</h4>
                {Object.entries(detail.hardware.inventory_sources).map(
                  ([group, sources]) => {
                    const paths = detail.hardware?.inventory[group] ?? [];
                    return (
                      <details key={group}>
                        <summary>
                          {t(`selftest.hardware.group.${group}`)} (
                          {paths.length})
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
                  },
                )}
              </section>
            </div>
          ) : null}

          {detailTab === "packages" || detailTab === "features" ? (
            <div
              className="selftest-list-pane"
              role="tabpanel"
              id={`selftest-panel-${detailTab}`}
              aria-labelledby={`selftest-tab-${detailTab}`}
              tabIndex={0}
            >
              <Input
                value={listFilter}
                placeholder={t("selftest.filterList")}
                onChange={(e) => setListFilter(e.target.value)}
              />
              <ul className="selftest-mono-list">
                {(detailTab === "packages"
                  ? filteredPackages
                  : filteredFeatures
                ).map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              {(detailTab === "packages" ? filteredPackages : filteredFeatures)
                .length === 0 ? (
                <p className="quiet">{t("selftest.emptyList")}</p>
              ) : null}
            </div>
          ) : null}

          {detailTab === "diff" ? (
            <DiffPanel
              detail={detail}
              baselineRecord={baselineRecord}
              compareId={compareId}
              setCompareId={setCompareId}
              compareCandidates={compareCandidates}
              diff={diff}
              diffLoading={diffLoading}
              diffTotal={diffTotal}
              diffCounts={diffCounts}
              diffScope={diffScope}
              setDiffScope={setDiffScope}
              diffFilter={diffFilter}
              setDiffFilter={setDiffFilter}
              shownFieldChanges={shownFieldChanges}
              shownDrmAdded={shownDrmAdded}
              shownDrmRemoved={shownDrmRemoved}
              shownPkgsAdded={shownPkgsAdded}
              shownPkgsRemoved={shownPkgsRemoved}
              shownFeatsAdded={shownFeatsAdded}
              shownFeatsRemoved={shownFeatsRemoved}
              shownPkgsSame={shownPkgsSame}
              shownFeatsSame={shownFeatsSame}
              handleSwapDiff={() => void handleSwapDiff()}
              handleCopyDiffMarkdown={handleCopyDiffMarkdown}
            />
          ) : null}

          {detailTab === "launcher" ? (
            <LauncherLayoutPanel
              layout={activeLauncherLayout}
              serial={collection.adb.serial}
              inspecting={inspectingLauncher}
              onInspectLive={handleInspectLauncher}
              onCopied={() => toast.show(t("common.copied"))}
            />
          ) : null}
        </>
      )}
    </>
  );

  return (
    <>
      <SelfTestWorkspace
        notice={
          <>
            {!desktop() ? (
              <p className="selftest-browser-note" role="status">
                {t("app.browserPreview")}
              </p>
            ) : null}

            {error || (collection.error && !collection.open) ? (
              <p role="alert" className="cal-region-error">
                {error || collection.error}
              </p>
            ) : null}
          </>
        }
        sidebar={sidebar}
        detail={recordDetail}
        collection={
          <CollectionDialog
            collection={collection}
            finalFocus={collectionFinalFocus}
          />
        }
        checks={
          <ChecksPanel
            key={detail?.id}
            ref={checksRef}
            recordId={detail?.id}
            groups={checkGroups}
            loading={loadingRecords}
            checking={checking}
            recheckDisabled={collection.collecting || savingMeta}
            onRecheck={() => void handleRecheck()}
            getAction={(check) => {
              if (check === backupCheck) {
                return {
                  label: t(
                    check.code === "vendor_boot_backup_pending"
                      ? "selftest.vendorBootReviewAction"
                      : "selftest.vendorBootBackupAction",
                  ),
                  run: () => setReviewOpen(true),
                };
              }
              if (checkField(check)) {
                return {
                  label: t("selftest.jumpToField"),
                  run: () => jumpToCheck(check),
                };
              }
              if (check.code.startsWith("gemini_")) {
                return {
                  label: t("selftest.launcher.viewLayout"),
                  run: () => setDetailTab("launcher"),
                };
              }
            }}
          />
        }
      />

      <Dialog
        open={!!pendingSwitch}
        onOpenChange={(open) => {
          if (!open && !switching) setPendingSwitch(null);
        }}
      >
        <DialogContent className="settings-dialog selftest-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="workspace-dialog-title">
              {t("selftest.unsavedTitle")}
            </DialogTitle>
            <DialogDescription>{t("selftest.unsavedBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={switching}
              onClick={() => setPendingSwitch(null)}
            >
              {t("selftest.cancel")}
            </Button>
            <Button
              variant="ghost"
              disabled={switching}
              onClick={() => void handleDiscardAndSwitch()}
            >
              {t("selftest.discard")}
            </Button>
            <Button
              disabled={switching}
              onClick={() => void handleSaveAndSwitch()}
            >
              {switching ? <Spinner aria-hidden="true" /> : null}
              {t("selftest.saveAndSwitch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        draft={emailDraft}
        others={records
          .filter(
            (record) =>
              record.id !== detail?.id && record.review_status === "ready",
          )
          .map((record) => ({
            id: record.id,
            label: `${record.model_code || record.model} · ${record.build}`,
          }))}
        buildBlock={async (id) => submissionEmailBlock(await selfTestGet(id))}
        initialMergeId={emailMergeId}
      />

      {detail ? (
        <ReviewDialog
          open={reviewOpen}
          record={detail}
          baselineId={compareId || detail.baseline_id || undefined}
          onOpenChange={setReviewOpen}
          onSaved={(updated) => {
            applyDetail(updated);
            void refreshList(updated.id);
          }}
        />
      ) : null}

      <ElevatedConfirm
        open={emailGateOpen}
        tone="warning"
        title={t("selftest.review.emailElevatedTitle")}
        description={t("selftest.review.emailElevatedBody")}
        ack={t("selftest.review.emailElevatedAck")}
        confirmLabel={t("selftest.review.emailElevatedConfirm")}
        cancelLabel={t("selftest.review.cancel")}
        onCancel={() => {
          setEmailGateOpen(false);
          setEmailGateTarget(null);
        }}
        onConfirm={() => void confirmEmail()}
        details={
          <div className="elevated-summary">
            <div className="elevated-summary-wide">
              <span>{t("selftest.review.summaryRecord")}</span>
              <strong>{emailGateTarget?.name || "-"}</strong>
            </div>
            <div>
              <span>{t("selftest.review.summaryReview")}</span>
              <strong>
                {emailGatePlan
                  ? `${emailGatePlan.counts.confirmed + emailGatePlan.counts.waived}/${emailGatePlan.counts.required}`
                  : "-"}
              </strong>
            </div>
            <div>
              <span>{t("selftest.review.summaryWarnings")}</span>
              <strong>
                {emailGatePlan
                  ? emailGatePlan.items.filter(
                      (item) => item.group === "warning",
                    ).length
                  : 0}
              </strong>
            </div>
            <div className="elevated-summary-wide">
              <span>Vendor boot debug</span>
              <strong>
                {emailGateTarget?.artifacts?.vendor_boot_debug?.path || "-"}
              </strong>
            </div>
          </div>
        }
      />

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent className="settings-dialog selftest-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="workspace-dialog-title">
              {t("selftest.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("selftest.deleteBody", {
                name: pendingDelete?.label ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              {t("selftest.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? (
                <Spinner aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              {t("selftest.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
