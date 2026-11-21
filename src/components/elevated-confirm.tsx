import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/i18n";

export function ElevatedConfirm({
  open,
  tone = "warning",
  title,
  description,
  details,
  ack,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  tone?: "warning" | "danger";
  title: string;
  description: string;
  details?: ReactNode;
  ack: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const blockEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", blockEscape, true);
    return () => document.removeEventListener("keydown", blockEscape, true);
  }, [open]);

  const Icon = tone === "danger" ? AlertTriangle : ShieldCheck;

  return (
    <Dialog open={open} onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent
        className="elevated-dialog"
        overlayClassName="elevated-overlay"
        showCloseButton={false}
      >
        <div className="elevated-heading">
          <div className="elevated-icon" data-tone={tone}>
            <Icon aria-hidden="true" />
          </div>
          <DialogHeader className="elevated-header">
            <DialogTitle className="elevated-title">{title}</DialogTitle>
            <DialogDescription className="elevated-description">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {details ? <div className="elevated-details">{details}</div> : null}

        <label className="elevated-ack">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
          />
          <span>{ack}</span>
        </label>

        <DialogFooter className="elevated-footer">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            disabled={!confirmed || busy}
            onClick={onConfirm}
          >
            {busy ? <Spinner aria-hidden="true" /> : null}
            {busy ? t("selftest.review.saving") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
