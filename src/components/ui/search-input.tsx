import { useRef, type Ref } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export function SearchInput({
  ref,
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  clearLabel,
}: {
  ref?: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  clearLabel?: string;
}) {
  const { t } = useTranslation();
  const localRef = useRef<HTMLInputElement | null>(null);
  const assignRef = (node: HTMLInputElement | null) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref && "current" in ref)
      (ref as { current: HTMLInputElement | null }).current = node;
  };
  const clearText = clearLabel ?? t("selftest.clearSearch");

  return (
    <div className={cn("selftest-search-input-wrap", className)}>
      <Input
        ref={assignRef}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="selftest-search-clear"
          aria-label={clearText}
          title={clearText}
          onClick={() => {
            onChange("");
            localRef.current?.focus();
          }}
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
