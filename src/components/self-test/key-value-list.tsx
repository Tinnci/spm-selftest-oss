import { useEffect, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ContextTarget } from "@/components/context-menu";
import { useCopyWithToast } from "@/hooks/useCopyWithToast";

export type KeyValueItem = {
  key: string;
  label: string;
  value: string;
  title?: string;
  badge?: ReactNode;
  highlighted?: boolean;
  rowRef?: Ref<HTMLDivElement>;
};

export function KeyValueList({
  items,
  copyable = true,
  role,
  id,
  labelledBy,
  tabIndex,
}: {
  items: KeyValueItem[];
  copyable?: boolean;
  role?: "tabpanel";
  id?: string;
  labelledBy?: string;
  tabIndex?: number;
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async (key: string, value: string) => {
    const ok = await copyWithToast(value);
    if (!ok) return;
    setCopiedKey(key);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedKey(null), 1200);
  };

  return (
    <dl
      className="selftest-fields"
      role={role}
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={tabIndex}
    >
      {items.map((item) => {
        const isCopied = copiedKey === item.key;
        const row = (
          <div
            key={copyable ? undefined : item.key}
            className={`selftest-field-row${item.highlighted ? " is-highlight" : ""}`}
            ref={item.rowRef}
            tabIndex={item.highlighted ? -1 : undefined}
            data-field={item.key}
          >
            <dt>{item.label}</dt>
            <dd>
              {copyable ? (
                <button
                  type="button"
                  className={`selftest-kv-value${item.value === "(not set)" ? " is-unset" : ""}`}
                  title={item.title ?? t("selftest.ctxCopyValue")}
                  onClick={() => void handleCopy(item.key, item.value)}
                >
                  {item.value}
                </button>
              ) : (
                <span
                  className={item.value === "(not set)" ? "quiet" : undefined}
                  title={item.title}
                >
                  {item.value}
                </span>
              )}
              {item.badge}
              {copyable ? (
                <button
                  type="button"
                  className={`selftest-copy-value${isCopied ? " is-copied" : ""}`}
                  aria-label={`${t("selftest.ctxCopyValue")} ${item.label}`}
                  title={t("selftest.ctxCopyValue")}
                  onClick={() => void handleCopy(item.key, item.value)}
                >
                  {isCopied ? (
                    <Check size={11} aria-hidden="true" />
                  ) : (
                    <Copy size={11} aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </dd>
          </div>
        );

        if (!copyable) return row;

        return (
          <ContextTarget
            key={item.key}
            title={item.label}
            actions={[
              {
                id: "copy-val",
                label: t("selftest.ctxCopyValue"),
                icon: Copy,
                run: () => handleCopy(item.key, item.value),
              },
              {
                id: "copy-pair",
                label: t("selftest.ctxCopyPair"),
                icon: Copy,
                run: () =>
                  copyWithToast(`${item.label}: ${item.value}`).then((ok) => {
                    if (ok) {
                      setCopiedKey(item.key);
                      clearTimeout(timerRef.current);
                      timerRef.current = setTimeout(
                        () => setCopiedKey(null),
                        1200,
                      );
                    }
                  }),
              },
            ]}
          >
            {row}
          </ContextTarget>
        );
      })}
    </dl>
  );
}
