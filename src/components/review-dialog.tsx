import { useCallback, useEffect, useState } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { ChevronDown, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ElevatedConfirm } from "@/components/elevated-confirm";
import { checkText, vendorBootBackupCheck } from "@/selftest/checks";
import { errorText } from "@/selftest/errors";
import {
  groupReviewItems,
  localDecisions,
  reviewItemHint,
  reviewItemText,
  reviewProgress,
  type LocalReviewDecision,
} from "@/selftest/review";
import {
  selfTestReviewPlan,
  selfTestReviewSave,
  type ArtifactRef,
  type ReviewItem,
  type ReviewPlan,
  type SelfTestRecord,
} from "@/api/self_test";
import { t } from "@/i18n";

function emptyArtifact(): ArtifactRef {
  return { path: "", sha256: "", note: "", checked: false };
}

function stateTone(item: ReviewItem): string {
  if (item.level === "error") return "selftest-tone-error";
  if (item.level === "warn") return "selftest-tone-warn";
  return "selftest-tone-pass";
}

export function ReviewDialog({
  open,
  record,
  baselineId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  record: SelfTestRecord;
  baselineId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: SelfTestRecord) => void;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, LocalReviewDecision>
  >({});
  const [artifact, setArtifact] = useState<ArtifactRef>(emptyArtifact);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await selfTestReviewPlan(record.id, baselineId);
      setPlan(next);
      setDecisions(localDecisions(next));
      setArtifact(next.artifacts.vendor_boot_debug ?? emptyArtifact());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [record.id, baselineId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false);
      setSaving(false);
    }
  }, [open]);

  const progress = reviewProgress(plan, decisions);
  const groups = plan ? groupReviewItems(plan.items) : [];
  const backupCheck = plan
    ? vendorBootBackupCheck(plan, record.test_type)
    : undefined;

  const setDecision = (id: string, state: LocalReviewDecision["state"]) => {
    setDecisions((prev) => ({
      ...prev,
      [id]: { state, note: prev[id]?.note ?? "" },
    }));
  };

  const setNote = (id: string, note: string) => {
    setDecisions((prev) => ({
      ...prev,
      [id]: { state: prev[id]?.state ?? "", note },
    }));
  };

  const resetArtifactDecision = () => {
    const item = plan?.items.find(
      (candidate) => candidate.group === "artifact",
    );
    if (!item) return;
    setDecisions((prev) => ({
      ...prev,
      [item.id]: { state: "", note: prev[item.id]?.note ?? "" },
    }));
  };

  const confirmGroup = (items: ReviewItem[]) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!item.required) continue;
        next[item.id] = {
          state: "confirmed",
          note: prev[item.id]?.note ?? "",
        };
      }
      return next;
    });
  };

  const validate = (): string => {
    if (!plan) return t("selftest.review.notLoaded");
    if (plan.vendor_boot_required && !artifact.path.trim()) {
      return t("selftest.review.artifactRequired");
    }
    for (const item of plan.items) {
      const decision = decisions[item.id];
      if (!decision?.state) {
        if (item.required) {
          return t("selftest.review.incomplete", { count: progress.pending });
        }
        continue;
      }
      if (decision.state === "waived" && !decision.note.trim()) {
        return t("selftest.review.waiveNoteRequired");
      }
    }
    return "";
  };

  const requestSave = () => {
    const message = validate();
    if (message) {
      toast.error(message);
      return;
    }
    setConfirmOpen(true);
  };

  const save = async () => {
    if (!plan || saving) return;
    setSaving(true);
    try {
      const payload: Record<
        string,
        { state: string; note: string; at: string; by: string }
      > = {};
      for (const [id, decision] of Object.entries(decisions)) {
        if (!decision.state) continue;
        payload[id] = {
          state: decision.state,
          note: decision.note,
          at: "",
          by: "",
        };
      }
      const updated = await selfTestReviewSave({
        id: record.id,
        baselineId,
        fingerprint: plan.fingerprint,
        decisions: payload,
        artifacts: { vendor_boot_debug: artifact },
      });
      setConfirmOpen(false);
      onSaved(updated);
      const blocked = plan.items.some((item) => item.group === "blocking");
      toast.success(
        t(blocked ? "selftest.review.savedBlocked" : "selftest.review.saved"),
      );
      onOpenChange(false);
    } catch (e) {
      setConfirmOpen(false);
      toast.error(errorText(e));
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="review-dialog"
          showCloseButton={false}
          aria-describedby={undefined}
        >
          <DialogHeader className="review-header">
            <div className="review-title-row">
              <div>
                <DialogTitle className="workspace-dialog-title">
                  {t("selftest.review.title", {
                    name: record.name || record.id,
                  })}
                </DialogTitle>
                <DialogDescription>
                  {t("selftest.review.description")}
                </DialogDescription>
              </div>
              <div className="review-progress" aria-live="polite">
                <strong>
                  {progress.done}/{progress.required}
                </strong>
                <span>{t("selftest.review.progress")}</span>
              </div>
            </div>
            <Progress
              value={
                progress.required
                  ? Math.round((progress.done / progress.required) * 100)
                  : 0
              }
            />
          </DialogHeader>

          {plan?.stale ? (
            <div className="review-banner" role="status">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>{t("selftest.review.stale")}</strong>
                <p>{t("selftest.review.staleHint")}</p>
              </div>
            </div>
          ) : null}

          {plan && plan.counts.total === 0 ? (
            <p className="quiet">{t("selftest.review.noItems")}</p>
          ) : null}

          <div className="review-meta-note">
            {plan?.updated_at ? (
              <span>
                {t("selftest.review.lastReviewed", {
                  time: plan.updated_at.slice(0, 16).replace("T", " "),
                })}
              </span>
            ) : (
              <span>{t("selftest.review.notReviewed")}</span>
            )}
            {plan?.baseline_id ? (
              <span>
                {t("selftest.review.baseline", { id: plan.baseline_id })}
              </span>
            ) : null}
          </div>

          {loading ? (
            <p className="quiet selftest-loading" role="status">
              <Spinner aria-hidden="true" /> {t("selftest.review.loading")}
            </p>
          ) : error ? (
            <p role="alert" className="cal-region-error">
              {error}
            </p>
          ) : plan ? (
            <div className="review-body">
              <section className="review-artifact">
                <div className="review-artifact-head">
                  <strong>{t("selftest.review.artifactTitle")}</strong>
                  <Badge
                    variant="outline"
                    className={
                      plan.vendor_boot_required
                        ? "selftest-tone-warn"
                        : undefined
                    }
                  >
                    {plan.vendor_boot_required
                      ? t("selftest.review.required")
                      : t("selftest.review.optional")}
                  </Badge>
                </div>
                <div className="review-artifact-grid">
                  <label className="selftest-field review-artifact-path">
                    <span className="selftest-field-label">
                      {t("selftest.review.artifactPath")}
                    </span>
                    <Input
                      value={artifact.path}
                      placeholder={t("selftest.review.artifactPathPlaceholder")}
                      onChange={(event) => {
                        setArtifact((prev) => ({
                          ...prev,
                          path: event.target.value,
                        }));
                        resetArtifactDecision();
                      }}
                    />
                  </label>
                  <label className="selftest-field review-artifact-sha">
                    <span className="selftest-field-label">
                      {t("selftest.review.artifactSha")}
                    </span>
                    <Input
                      value={artifact.sha256}
                      placeholder={t("selftest.review.artifactShaPlaceholder")}
                      onChange={(event) => {
                        setArtifact((prev) => ({
                          ...prev,
                          sha256: event.target.value,
                        }));
                        resetArtifactDecision();
                      }}
                    />
                  </label>
                  <label className="selftest-field review-artifact-note">
                    <span className="selftest-field-label">
                      {t("selftest.review.artifactNote")}
                    </span>
                    <Input
                      value={artifact.note}
                      onChange={(event) =>
                        setArtifact((prev) => ({
                          ...prev,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {plan.vendor_boot_required ? (
                  <p className="quiet review-artifact-hint">
                    {t("selftest.review.artifactHint")}
                  </p>
                ) : null}
              </section>

              <div className="review-scroll">
                <Accordion.Root
                  multiple
                  defaultValue={groups.map((group) => group.group)}
                  className="review-accordion"
                >
                  {groups.map((group) => {
                    const done = group.items.filter((item) => {
                      const state = decisions[item.id]?.state;
                      return state === "confirmed" || state === "waived";
                    }).length;
                    return (
                      <Accordion.Item
                        key={group.group}
                        value={group.group}
                        className="review-section"
                      >
                        <Accordion.Header>
                          <Accordion.Trigger className="review-section-trigger">
                            <span>{group.label}</span>
                            <span className="review-section-count">
                              {done}/{group.items.length}
                            </span>
                            <ChevronDown
                              className="review-chevron"
                              aria-hidden="true"
                            />
                          </Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Panel className="review-section-panel">
                          {group.group !== "artifact" &&
                          group.group !== "manual" ? (
                            <div className="review-section-actions">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => confirmGroup(group.items)}
                              >
                                {t("selftest.review.confirmAll")}
                              </Button>
                            </div>
                          ) : null}
                          {group.items.map((item) => {
                            const decision = decisions[item.id] ?? {
                              state: "",
                              note: "",
                            };
                            const hint = reviewItemHint(item);
                            const isDone =
                              decision.state === "confirmed" ||
                              decision.state === "waived";
                            return (
                              <div
                                key={item.id}
                                className={
                                  isDone ? "review-item is-done" : "review-item"
                                }
                              >
                                <div className="review-item-text">
                                  <div className="review-item-title">
                                    <Badge
                                      variant="outline"
                                      className={stateTone(item)}
                                    >
                                      {item.level.toUpperCase()}
                                    </Badge>
                                    <span>
                                      {item.group === "artifact" && backupCheck
                                        ? checkText(backupCheck)
                                        : reviewItemText(item)}
                                    </span>
                                  </div>
                                  {hint ? (
                                    <p className="review-item-hint">{hint}</p>
                                  ) : null}
                                  {!item.required ? (
                                    <span className="review-item-optional">
                                      {t("selftest.review.optional")}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="review-item-actions">
                                  <ToggleGroup
                                    multiple={false}
                                    value={
                                      decision.state ? [decision.state] : []
                                    }
                                    onValueChange={(values) =>
                                      setDecision(
                                        item.id,
                                        (values[0] as LocalReviewDecision["state"]) ??
                                          "",
                                      )
                                    }
                                    className="review-choice"
                                  >
                                    <Toggle
                                      value="confirmed"
                                      className="review-choice-button"
                                    >
                                      {t("selftest.review.confirm")}
                                    </Toggle>
                                    {item.can_waive ? (
                                      <Toggle
                                        value="waived"
                                        className="review-choice-button"
                                      >
                                        {t("selftest.review.waive")}
                                      </Toggle>
                                    ) : null}
                                  </ToggleGroup>
                                  {decision.state === "waived" ? (
                                    <Input
                                      className="review-waive-note"
                                      value={decision.note}
                                      placeholder={t(
                                        "selftest.review.waiveReason",
                                      )}
                                      aria-label={t(
                                        "selftest.review.waiveReason",
                                      )}
                                      onChange={(event) =>
                                        setNote(item.id, event.target.value)
                                      }
                                    />
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion.Root>
              </div>
            </div>
          ) : null}

          <DialogFooter className="review-footer">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("selftest.review.close")}
            </Button>
            <Button
              variant="outline"
              disabled={!plan || loading}
              onClick={() => void load()}
            >
              {t("selftest.review.refresh")}
            </Button>
            <Button disabled={!plan || loading || saving} onClick={requestSave}>
              <ShieldCheck aria-hidden="true" />
              {t("selftest.review.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ElevatedConfirm
        open={confirmOpen}
        tone="warning"
        title={t("selftest.review.elevatedTitle")}
        description={t("selftest.review.elevatedBody")}
        ack={t("selftest.review.elevatedAck")}
        confirmLabel={t("selftest.review.elevatedConfirm")}
        cancelLabel={t("selftest.review.cancel")}
        busy={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void save()}
        details={
          <div className="elevated-summary">
            <div>
              <span>{t("selftest.review.summaryConfirmed")}</span>
              <strong>{progress.done}</strong>
            </div>
            <div>
              <span>{t("selftest.review.summaryPending")}</span>
              <strong>{progress.pending}</strong>
            </div>
            {artifact.path ? (
              <div className="elevated-summary-wide">
                <span>Vendor boot debug</span>
                <strong>{artifact.path}</strong>
              </div>
            ) : null}
          </div>
        }
      />
    </>
  );
}
