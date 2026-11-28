import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HighlightText } from "@/components/ui/highlight-text";
import { SearchInput } from "@/components/ui/search-input";
import { useCopyWithToast } from "@/hooks/useCopyWithToast";

export function FilterableMonoList({
  items,
  filter,
  onFilterChange,
  placeholder,
  emptyText,
  panelId,
  tabId,
}: {
  items: string[];
  filter: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
  emptyText: string;
  panelId: string;
  tabId: string;
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const [copiedEntry, setCopiedEntry] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async (entry: string) => {
    const ok = await copyWithToast(entry);
    if (!ok) return;
    setCopiedEntry(entry);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedEntry(null), 1200);
  };

  return (
    <div
      className="selftest-list-pane"
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
    >
      <SearchInput
        value={filter}
        placeholder={placeholder}
        ariaLabel={placeholder}
        onChange={onFilterChange}
      />
      <ul className="selftest-mono-list">
        {items.map((entry) => {
          const isCopied = copiedEntry === entry;
          return (
            <li key={entry}>
              <button
                type="button"
                className={`selftest-mono-item${isCopied ? " is-copied" : ""}`}
                title={t("selftest.ctxCopyValue")}
                onClick={() => void handleCopy(entry)}
              >
                <span className="selftest-mono-item-text">
                  <HighlightText text={entry} query={filter} />
                </span>
                <span className="selftest-mono-item-icon" aria-hidden="true">
                  {isCopied ? <Check size={12} /> : <Copy size={12} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {items.length === 0 ? <p className="quiet">{emptyText}</p> : null}
    </div>
  );
}
