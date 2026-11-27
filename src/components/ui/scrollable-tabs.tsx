import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useHorizontalScroll } from "@/hooks/useHorizontalScroll";

export type ScrollableTabItem<T extends string> = {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  tabId?: string;
  panelId?: string;
  dot?: "error" | "warn" | "info";
};

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

export function ScrollableTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = "selftest-tabs",
  scrollKey,
}: {
  tabs: ScrollableTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  scrollKey?: string;
}) {
  const tabsRef = useHorizontalScroll<HTMLDivElement>();
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const syncIndicator = useCallback(() => {
    const container = tabsRef.current;
    const activeTab = container?.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!container || !activeTab) {
      setIndicator(null);
      return;
    }
    setIndicator({
      left: activeTab.offsetLeft,
      width: activeTab.offsetWidth,
    });
  }, [tabsRef]);

  useEffect(() => {
    syncIndicator();
    const container = tabsRef.current;
    if (!container) return;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncIndicator)
        : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [value, scrollKey, tabs.length, syncIndicator, tabsRef]);

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
  }, [value, scrollKey, tabsRef]);

  return (
    <div
      ref={tabsRef}
      className={className}
      role="tablist"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={moveTabFocus}
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tab.tabId}
            aria-controls={tab.panelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? "is-active" : ""}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            {tab.label}
            {tab.dot ? (
              <span
                className={`selftest-tab-dot is-${tab.dot}`}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
      {indicator && indicator.width > 0 ? (
        <span
          className="selftest-tabs-indicator"
          aria-hidden="true"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: `${indicator.width}px`,
          }}
        />
      ) : null}
    </div>
  );
}
