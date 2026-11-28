import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { useCopyWithToast } from "@/hooks/useCopyWithToast";

export function CopyPre({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    const ok = await copyWithToast(text);
    if (!ok) return;
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={cn("selftest-pre-wrap", className)}>
      <pre>{text}</pre>
      <button
        type="button"
        className={`selftest-pre-copy${copied ? " is-copied" : ""}`}
        aria-label={t("selftest.ctxCopyValue")}
        title={t("selftest.ctxCopyValue")}
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <Check size={12} aria-hidden="true" />
        ) : (
          <Copy size={12} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
