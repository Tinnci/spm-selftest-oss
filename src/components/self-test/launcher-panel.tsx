import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Copy,
  Folder,
  LayoutGrid,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/ui/highlight-text";
import { SearchInput } from "@/components/ui/search-input";
import type { LauncherItem, LauncherLayout } from "../../api/self_test";
import { useCopyWithToast } from "../../hooks/useCopyWithToast";

function itemLabel(item: LauncherItem): string {
  if (item.title) return item.title;
  if (item.package) return item.package.split(".").pop() || item.package;
  if (item.component) return item.component;
  return `#${item.id}`;
}

function itemMonogram(item: LauncherItem): string {
  const label = itemLabel(item).trim();
  return label ? label.slice(0, 1).toUpperCase() : "?";
}

function isGeminiItem(item: LauncherItem): boolean {
  return (
    item.package.toLowerCase() === "com.google.android.apps.bard" ||
    item.component.toLowerCase().includes("com.google.android.apps.bard") ||
    item.title.trim().toLowerCase() === "gemini"
  );
}

function itemKey(item: LauncherItem): string {
  return `${item.container}:${item.id}:${item.screen}:${item.cell_x}:${item.cell_y}`;
}

export function LauncherLayoutPanel({
  layout,
  serial,
  inspecting,
  onInspectLive,
  onCopied,
}: {
  layout: LauncherLayout | null | undefined;
  serial: string;
  inspecting: boolean;
  onInspectLive: () => Promise<void>;
  onCopied?: () => void;
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const [filter, setFilter] = useState("");
  const [activeScreen, setActiveScreen] = useState<number | "all">(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopyValue = async (key: string, value: string) => {
    const ok = await copyWithToast(value);
    if (!ok) return;
    onCopied?.();
    setCopiedKey(key);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1200);
  };

  const screens = useMemo(() => {
    if (!layout) return [];
    const byScreen = new Map<number, LauncherItem[]>();
    for (const item of layout.items) {
      if (item.container !== "workspace") continue;
      const list = byScreen.get(item.screen) ?? [];
      list.push(item);
      byScreen.set(item.screen, list);
    }
    return [...byScreen.entries()].sort((a, b) => a[0] - b[0]);
  }, [layout]);

  const hotseatItems = useMemo(
    () =>
      (layout?.items ?? [])
        .filter((i) => i.container === "hotseat")
        .sort((a, b) => a.cell_x - b.cell_x),
    [layout],
  );

  const folders = useMemo(() => {
    const items = layout?.items ?? [];
    const byFolder = new Map<string, LauncherItem[]>();
    for (const item of items) {
      if (item.container !== "folder" || !item.folder_id) continue;
      const list = byFolder.get(item.folder_id) ?? [];
      list.push(item);
      byFolder.set(item.folder_id, list);
    }
    for (const list of byFolder.values()) {
      list.sort(
        (a, b) =>
          (a.rank ?? 0) - (b.rank ?? 0) ||
          a.cell_y - b.cell_y ||
          a.cell_x - b.cell_x,
      );
    }
    return {
      byId: byFolder,
      headers: items.filter((i) => i.item_type === "folder"),
    };
  }, [layout]);

  const geminiPlacement = useMemo(() => {
    if (!layout || !layout.items.length) return null;
    for (const item of layout.items) {
      if (!isGeminiItem(item)) continue;
      if (item.container === "hotseat") {
        return {
          ok: true,
          screen: "Hotseat",
          screenIndex: null as number | null,
        };
      }
      if (item.container === "workspace") {
        return {
          ok: item.screen === 0 || item.screen === 1,
          screen: String(item.screen + 1),
          screenIndex: item.screen,
        };
      }
      if (item.container === "folder" && item.folder_id) {
        const parent = layout.items.find((p) => p.id === item.folder_id);
        if (parent) {
          return {
            ok:
              parent.container === "hotseat" ||
              parent.screen === 0 ||
              parent.screen === 1,
            screen:
              parent.container === "hotseat"
                ? "Hotseat"
                : String(parent.screen + 1),
            screenIndex:
              parent.container === "workspace" ? parent.screen : null,
          };
        }
      }
    }
    return { ok: false, screen: null, screenIndex: null as number | null };
  }, [layout]);

  const selectedItem = useMemo(() => {
    if (!layout || !selectedKey) return null;
    return layout.items.find((item) => itemKey(item) === selectedKey) ?? null;
  }, [layout, selectedKey]);

  const filteredItems = useMemo(() => {
    const items = layout?.items ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.package, item.component, item.container, item.item_type]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [layout, filter]);

  const visibleScreens = useMemo(() => {
    if (activeScreen === "all") return screens;
    const found = screens.find(([idx]) => idx === activeScreen);
    return found ? [found] : screens.slice(0, 1);
  }, [screens, activeScreen]);

  const emptySlots = useMemo(() => {
    if (!layout) return [];
    const cols = Math.max(1, layout.grid_columns);
    const rows = Math.max(1, layout.grid_rows);
    const slots: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        slots.push({ x, y });
      }
    }
    return slots;
  }, [layout]);

  const selectItem = (item: LauncherItem) => {
    setSelectedKey(itemKey(item));
    if (item.container === "workspace") {
      setActiveScreen(item.screen);
    } else if (item.container === "folder" && item.folder_id && layout) {
      const parent = layout.items.find((p) => p.id === item.folder_id);
      if (parent && parent.container === "workspace") {
        setActiveScreen(parent.screen);
      }
    }
  };

  return (
    <div
      className="selftest-launcher-panel"
      role="tabpanel"
      id="selftest-panel-launcher"
      aria-labelledby="selftest-tab-launcher"
      tabIndex={0}
    >
      <div className="selftest-launcher-bar">
        <div className="selftest-launcher-summary">
          <Badge variant="outline">
            <LayoutGrid size={12} aria-hidden="true" />
            {layout
              ? `${layout.grid_columns}×${layout.grid_rows}`
              : t("selftest.launcher.noLayout")}
          </Badge>
          {geminiPlacement ? (
            <Badge
              variant="outline"
              className={
                geminiPlacement.ok ? "selftest-tone-pass" : "selftest-tone-warn"
              }
            >
              <Sparkles size={11} aria-hidden="true" />
              {geminiPlacement.ok && geminiPlacement.screen
                ? t("selftest.launcher.geminiBadgeOk", {
                    screen: geminiPlacement.screen,
                  })
                : t("selftest.launcher.geminiBadgeWarn")}
            </Badge>
          ) : null}
          {layout?.launcher_package ? (
            <span className="selftest-launcher-chip">
              {t("selftest.launcher.defaultApp")}: {layout.launcher_package}
            </span>
          ) : null}
          {layout?.display_size ? (
            <span className="selftest-launcher-chip">
              {layout.display_size}
              {layout.display_density ? ` · ${layout.display_density}dpi` : ""}
            </span>
          ) : null}
        </div>
        <div className="selftest-launcher-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!serial || inspecting}
            onClick={() => void onInspectLive()}
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={inspecting ? "spin" : undefined}
            />
            {inspecting
              ? t("selftest.launcher.checking")
              : t("selftest.launcher.checkLive")}
          </Button>
          {layout ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                void handleCopyValue("json", JSON.stringify(layout, null, 2))
              }
            >
              {copiedKey === "json" ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {t("selftest.launcher.copyJson")}
            </Button>
          ) : null}
        </div>
      </div>

      {!layout ? (
        <EmptyState
          icon={LayoutGrid}
          title={t("selftest.launcher.noLayout")}
          description={t("selftest.launcher.empty")}
        />
      ) : (
        <>
          {layout.notes.length > 0 ? (
            <p className="selftest-empty-note">{layout.notes.join(" ")}</p>
          ) : null}

          <div className="selftest-launcher-split">
            <div className="selftest-launcher-stage">
              {screens.length > 1 ? (
                <div className="selftest-launcher-tabs" role="tablist">
                  {screens.map(([screen]) => {
                    const isCurrent =
                      activeScreen === screen ||
                      (activeScreen === 0 &&
                        !screens.some(([idx]) => idx === 0) &&
                        screen === screens[0]?.[0]);
                    const hasGemini = geminiPlacement?.screenIndex === screen;
                    return (
                      <button
                        key={`switch-${screen}`}
                        type="button"
                        role="tab"
                        aria-selected={isCurrent}
                        className={`selftest-launcher-pill${isCurrent ? " is-active" : ""}`}
                        onClick={() => setActiveScreen(screen)}
                      >
                        {t("selftest.launcher.screen", { index: screen + 1 })}
                        {hasGemini ? (
                          <span
                            className="selftest-launcher-dot"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeScreen === "all"}
                    className={`selftest-launcher-pill${activeScreen === "all" ? " is-active" : ""}`}
                    onClick={() => setActiveScreen("all")}
                  >
                    {t("selftest.launcher.allScreens")}
                  </button>
                </div>
              ) : null}

              <div
                className={`selftest-launcher-phones${activeScreen === "all" ? " is-multi" : ""}`}
              >
                {visibleScreens.map(([screen, items]) => (
                  <div key={screen} className="selftest-launcher-phone">
                    <div className="selftest-launcher-phone-head">
                      <span>
                        {t("selftest.launcher.screen", { index: screen + 1 })}
                      </span>
                      <span>
                        {layout.grid_columns}×{layout.grid_rows}
                      </span>
                    </div>

                    <div
                      className="selftest-launcher-grid"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(1, layout.grid_columns)}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${Math.max(1, layout.grid_rows)}, 54px)`,
                      }}
                    >
                      {emptySlots.map((slot) => (
                        <div
                          key={`slot-${screen}-${slot.x}-${slot.y}`}
                          className="selftest-launcher-slot"
                          style={{
                            gridColumn: `${slot.x + 1} / span 1`,
                            gridRow: `${slot.y + 1} / span 1`,
                          }}
                          aria-hidden="true"
                        />
                      ))}

                      {items.map((item) => {
                        const key = itemKey(item);
                        const selected = selectedKey === key;
                        const gemini = isGeminiItem(item);
                        const children =
                          item.item_type === "folder"
                            ? (folders.byId.get(item.id) ?? [])
                            : [];
                        const maxCols = Math.max(1, layout.grid_columns);
                        const maxRows = Math.max(1, layout.grid_rows);
                        const colStart = Math.min(
                          Math.max(1, item.cell_x + 1),
                          maxCols,
                        );
                        const rowStart = Math.min(
                          Math.max(1, item.cell_y + 1),
                          maxRows,
                        );
                        const colSpan = Math.min(
                          Math.max(1, item.span_x),
                          maxCols - colStart + 1,
                        );
                        const rowSpan = Math.min(
                          Math.max(1, item.span_y),
                          maxRows - rowStart + 1,
                        );
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`selftest-launcher-tile is-${item.item_type}${gemini ? " is-gemini" : ""}${selected ? " is-selected" : ""}`}
                            style={{
                              gridColumn: `${colStart} / span ${colSpan}`,
                              gridRow: `${rowStart} / span ${rowSpan}`,
                            }}
                            title={`${itemLabel(item)} (${item.cell_x},${item.cell_y})`}
                            onClick={() => selectItem(item)}
                          >
                            {item.item_type === "folder" ? (
                              <span className="selftest-launcher-folder-mini">
                                {children.slice(0, 4).map((child) => (
                                  <span key={itemKey(child)}>
                                    {itemMonogram(child)}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span
                                className={`selftest-launcher-icon${gemini ? " is-gemini" : ""}`}
                              >
                                {gemini ? (
                                  <Sparkles size={12} aria-hidden="true" />
                                ) : (
                                  itemMonogram(item)
                                )}
                              </span>
                            )}
                            <span className="selftest-launcher-tile-title">
                              {itemLabel(item)}
                            </span>
                            {item.item_type === "widget" ? (
                              <span className="selftest-launcher-tile-meta">
                                {item.span_x}×{item.span_y}
                              </span>
                            ) : item.item_type === "folder" ? (
                              <span className="selftest-launcher-tile-meta">
                                {children.length}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {hotseatItems.length > 0 ? (
                      <div className="selftest-launcher-dock">
                        <div
                          className="selftest-launcher-hotseat"
                          style={{
                            gridTemplateColumns: `repeat(${Math.max(1, layout.hotseat_count, hotseatItems.length)}, minmax(0, 1fr))`,
                          }}
                        >
                          {hotseatItems.map((item) => {
                            const key = itemKey(item);
                            const selected = selectedKey === key;
                            const gemini = isGeminiItem(item);
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`selftest-launcher-tile is-hotseat${gemini ? " is-gemini" : ""}${selected ? " is-selected" : ""}`}
                                title={itemLabel(item)}
                                onClick={() => selectItem(item)}
                              >
                                <span
                                  className={`selftest-launcher-icon${gemini ? " is-gemini" : ""}`}
                                >
                                  {gemini ? (
                                    <Sparkles size={12} aria-hidden="true" />
                                  ) : (
                                    itemMonogram(item)
                                  )}
                                </span>
                                <span className="selftest-launcher-tile-title">
                                  {itemLabel(item)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="selftest-launcher-inspector">
              {selectedItem ? (
                <div className="selftest-launcher-card">
                  <div className="selftest-launcher-card-head">
                    <div>
                      <strong>{itemLabel(selectedItem)}</strong>
                      <div className="selftest-launcher-chip">
                        {selectedItem.item_type} · {selectedItem.container}
                      </div>
                    </div>
                    {selectedItem.component ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t("selftest.ctxCopyValue")}
                        onClick={() =>
                          void handleCopyValue(
                            "component",
                            selectedItem.component,
                          )
                        }
                      >
                        {copiedKey === "component" ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          <Copy size={12} aria-hidden="true" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                  <dl className="selftest-launcher-kv">
                    <dt>{t("selftest.launcher.position")}</dt>
                    <dd>
                      {selectedItem.container === "workspace"
                        ? `${t("selftest.launcher.screen", { index: selectedItem.screen + 1 })} (${selectedItem.cell_x},${selectedItem.cell_y}) · ${selectedItem.span_x}×${selectedItem.span_y}`
                        : selectedItem.container === "hotseat"
                          ? `${t("selftest.launcher.hotseat")} #${selectedItem.cell_x + 1}`
                          : `#${selectedItem.folder_id ?? "-"} (${selectedItem.cell_x},${selectedItem.cell_y})`}
                    </dd>
                    {selectedItem.component || selectedItem.package ? (
                      <>
                        <dt>{t("selftest.launcher.component")}</dt>
                        <dd className="selftest-launcher-mono">
                          <button
                            type="button"
                            className="selftest-kv-value"
                            title={t("selftest.ctxCopyValue")}
                            onClick={() =>
                              void handleCopyValue(
                                "component",
                                selectedItem.component || selectedItem.package,
                              )
                            }
                          >
                            {selectedItem.component || selectedItem.package}
                          </button>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {selectedItem.item_type === "folder" ? (
                    <div className="selftest-launcher-folder-children">
                      <div className="selftest-launcher-screen-title">
                        {t("selftest.launcher.folderItems", {
                          count: (folders.byId.get(selectedItem.id) ?? [])
                            .length,
                        })}
                      </div>
                      <div className="selftest-launcher-child-chips">
                        {(folders.byId.get(selectedItem.id) ?? []).map(
                          (child, idx) => (
                            <button
                              key={itemKey(child)}
                              type="button"
                              className={`selftest-launcher-child-chip${isGeminiItem(child) ? " is-gemini" : ""}`}
                              onClick={() => selectItem(child)}
                            >
                              <span>{idx + 1}.</span>
                              <span>{itemLabel(child)}</span>
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="selftest-launcher-card">
                  <p className="selftest-launcher-chip">
                    {t("selftest.launcher.inspectorHint")}
                  </p>
                  {folders.headers.length > 0 ? (
                    <div className="selftest-launcher-folder-children">
                      <div className="selftest-launcher-screen-title">
                        {t("selftest.launcher.folders", {
                          count: folders.headers.length,
                        })}
                      </div>
                      <div className="selftest-launcher-child-chips">
                        {folders.headers.map((folder) => (
                          <button
                            key={itemKey(folder)}
                            type="button"
                            className="selftest-launcher-child-chip"
                            onClick={() => selectItem(folder)}
                          >
                            <Folder size={12} aria-hidden="true" />
                            <span>{itemLabel(folder)}</span>
                            <span>
                              ({(folders.byId.get(folder.id) ?? []).length})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="selftest-launcher-table-wrap">
                <SearchInput
                  value={filter}
                  onChange={setFilter}
                  placeholder={t("selftest.launcher.filterPlaceholder")}
                  ariaLabel={t("selftest.launcher.filterPlaceholder")}
                />
                <ul className="selftest-launcher-list">
                  {filteredItems.map((item) => {
                    const key = itemKey(item);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          className={`selftest-launcher-row${selectedKey === key ? " is-selected" : ""}`}
                          onClick={() => selectItem(item)}
                        >
                          <span className="selftest-launcher-item-pos">
                            {item.container === "workspace"
                              ? `S${item.screen + 1} (${item.cell_x},${item.cell_y})`
                              : item.container === "hotseat"
                                ? `Dock #${item.cell_x + 1}`
                                : `Folder #${item.folder_id ?? "-"}`}
                          </span>
                          <strong>
                            <HighlightText
                              text={itemLabel(item)}
                              query={filter}
                            />
                          </strong>
                          <span className="selftest-launcher-item-comp">
                            <HighlightText
                              text={item.package || item.component}
                              query={filter}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
