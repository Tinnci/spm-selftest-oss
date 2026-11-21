import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/clipboard";
import { t } from "@/i18n";
import { readEmailPrefs, writeEmailPrefs } from "@/selftest/email-prefs";

export type EmailDraft = { subject: string; body: string };

export type MergeCandidate = { id: string; label: string };

function insertBeforeSignature(body: string, block: string): string {
  const signature = t("selftest.email.signature");
  const index = body.lastIndexOf(signature);
  if (index < 0) return `${body.trimEnd()}\n\n${block}`;
  return `${body.slice(0, index).trimEnd()}\n\n${block}\n\n${body.slice(index)}`;
}

function withPaths(body: string, userPath: string, debugPath: string): string {
  if (!userPath.trim() && !debugPath.trim()) return body;
  const lines = [t("selftest.emailPaths")];
  if (userPath.trim()) {
    lines.push(`${t("selftest.emailUserPath")}: ${userPath.trim()}`);
  }
  if (debugPath.trim()) {
    lines.push(`${t("selftest.emailDebugPath")}: ${debugPath.trim()}`);
  }
  const block = ["", ...lines].join("\n");
  const signature = t("selftest.email.signature");
  const index = body.lastIndexOf(signature);
  if (index < 0) return `${body.trimEnd()}\n${block}`;
  return `${body.slice(0, index).trimEnd()}\n${block}\n\n${body.slice(index)}`;
}

export function EmailDialog({
  open,
  onOpenChange,
  draft,
  others = [],
  buildBlock,
  initialMergeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: EmailDraft;
  others?: MergeCandidate[];
  buildBlock?: (id: string) => Promise<string>;
  initialMergeId?: string;
}) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [userPath, setUserPath] = useState("");
  const [debugPath, setDebugPath] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [mergedBlock, setMergedBlock] = useState("");
  const [merging, setMerging] = useState(false);
  const mergeSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setSubject(draft.subject);
    setBody(draft.body);
    setMergeId("");
    setMergedBlock("");
    const prefs = readEmailPrefs();
    setTo(prefs.to);
    setCc(prefs.cc);
    setUserPath(prefs.userPath);
    setDebugPath(prefs.debugPath);
  }, [open, draft]);

  const applyMerge = async (nextId: string, baseBody?: string) => {
    const seq = ++mergeSeq.current;
    setMergeId(nextId);
    setMerging(true);
    try {
      let base = baseBody ?? body;
      if (mergedBlock) {
        base = base.split(`\n\n${mergedBlock}`).join("");
      }
      if (!nextId || !buildBlock) {
        setMergedBlock("");
        setBody(base.trimEnd());
        return;
      }
      const block = await buildBlock(nextId);
      if (seq !== mergeSeq.current) return;
      setMergedBlock(block);
      setBody(insertBeforeSignature(base, block));
    } catch {
      toast.error(t("selftest.mergeFailed"));
    } finally {
      if (seq === mergeSeq.current) setMerging(false);
    }
  };

  useEffect(() => {
    if (!open || !initialMergeId) return;
    void applyMerge(initialMergeId, draft.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMergeId]);

  const persist = () => writeEmailPrefs({ to, cc, userPath, debugPath });

  const copyBody = async () => {
    try {
      await copyText(withPaths(body, userPath, debugPath));
      persist();
      toast.success(t("selftest.copied"));
    } catch {
      toast.error(t("selftest.copyFailed"));
    }
  };

  const copyAll = async () => {
    try {
      const lines = [`${t("selftest.emailSubject")}: ${subject}`];
      if (to) lines.push(`${t("selftest.emailTo")}: ${to}`);
      if (cc) lines.push(`${t("selftest.emailCc")}: ${cc}`);
      lines.push("", withPaths(body, userPath, debugPath));
      await copyText(lines.join("\n"));
      persist();
      toast.success(t("selftest.copied"));
    } catch {
      toast.error(t("selftest.copyFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) persist();
        onOpenChange(next);
      }}
    >
      <DialogContent className="settings-dialog selftest-email-dialog">
        <DialogHeader>
          <DialogTitle className="workspace-dialog-title">
            {t("selftest.emailDialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("selftest.emailDialogHint")}</DialogDescription>
        </DialogHeader>
        <div className="selftest-email-form">
          <label className="selftest-email-field">
            <span>{t("selftest.emailSubject")}</span>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
          <div className="selftest-email-row">
            <label className="selftest-email-field">
              <span>{t("selftest.emailTo")}</span>
              <Input
                value={to}
                placeholder={t("selftest.emailRecipientsPlaceholder")}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <label className="selftest-email-field">
              <span>{t("selftest.emailCc")}</span>
              <Input
                value={cc}
                placeholder={t("selftest.emailRecipientsPlaceholder")}
                onChange={(event) => setCc(event.target.value)}
              />
            </label>
          </div>
          <div className="selftest-email-row">
            <label className="selftest-email-field">
              <span>{t("selftest.emailUserPath")}</span>
              <Input
                value={userPath}
                placeholder={t("selftest.emailPathPlaceholder")}
                onChange={(event) => setUserPath(event.target.value)}
              />
            </label>
            <label className="selftest-email-field">
              <span>{t("selftest.emailDebugPath")}</span>
              <Input
                value={debugPath}
                placeholder={t("selftest.emailPathPlaceholder")}
                onChange={(event) => setDebugPath(event.target.value)}
              />
            </label>
          </div>
          {others.length && buildBlock ? (
            <label className="selftest-email-field">
              <span>{t("selftest.emailMerge")}</span>
              <select
                className="cal-model-select"
                aria-label={t("selftest.emailMerge")}
                value={mergeId}
                disabled={merging}
                onChange={(event) => void applyMerge(event.target.value)}
              >
                <option value="">{t("selftest.emailMergeNone")}</option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="selftest-email-field">
            <span>{t("selftest.emailBody")}</span>
            <Textarea
              className="selftest-email-body"
              aria-label={t("selftest.emailBody")}
              rows={16}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          {merging ? (
            <p className="quiet selftest-email-merging" role="status">
              <Spinner aria-hidden="true" /> {t("selftest.emailMerging")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("selftest.close")}
          </Button>
          <Button variant="outline" onClick={() => void copyBody()}>
            {t("selftest.copyBody")}
          </Button>
          <Button onClick={() => void copyAll()}>
            {t("selftest.copyEmailAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
