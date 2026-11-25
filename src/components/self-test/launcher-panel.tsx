import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, LayoutGrid, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LauncherItem, LauncherLayout } from "../../api/self_test";
import { copyText } from "../../clipboard";

function itemLabel(item: LauncherItem): string {
  if (item.title) return item.title;
  if (item.package) return item.package;
  if (item.component) return item.component;
  return `#${item.id}`;
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
  onCopied: () => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

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
          {layout?.launcher_package ? (
            <span className="selftest-launcher-chip">
              {t("selftest.launcher.defaultApp")}: {layout.launcher_package}
            </span>
          ) : null}
          {layout?.display_size ? (
            <span className="selftest-launcher-chip">
              {layout.display_size}
              {layout.display_density ? ` @ ${layout.display_density}dpi` : ""}
            </span>
          ) : null}
          {layout?.source ? (
            <span className="selftest-launcher-chip">{layout.source}</span>
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
              onClick={() => {
                void copyText(JSON.stringify(layout, null, 2));
                onCopied();
              }}
            >
              <Copy size={13} aria-hidden="true" />
              {t("selftest.launcher.copyJson")}
            </Button>
          ) : null}
        </div>
      </div>

      {!layout ? (
        <p className="selftest-empty-note">{t("selftest.launcher.empty")}</p>
      ) : (
        <>
          {layout.notes.length > 0 ? (
            <p className="selftest-empty-note">{layout.notes.join(" ")}</p>
          ) : null}

          {screens.length > 0 ? (
            <div className="selftest-launcher-screens">
              {screens.map(([screen, items]) => (
                <div key={screen} className="selftest-launcher-screen">
                  <div className="selftest-launcher-screen-title">
                    {t("selftest.launcher.screen", { index: screen + 1 })}
                  </div>
                  <div
                    className="selftest-launcher-grid"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, layout.grid_columns)}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${Math.max(1, layout.grid_rows)}, minmax(38px, auto))`,
                    }}
                  >
                    {items.map((item) => (
                      <div
                        key={`${item.id}-${item.cell_x}-${item.cell_y}`}
                        className={`selftest-launcher-cell is-${item.item_type}`}
                        style={{
                          gridColumn: `${Math.max(1, item.cell_x + 1)} / span ${Math.max(1, item.span_x)}`,
                          gridRow: `${Math.max(1, item.cell_y + 1)} / span ${Math.max(1, item.span_y)}`,
                        }}
                        title={item.component || item.package || item.title}
                      >
                        <span className="selftest-launcher-cell-title">
                          {itemLabel(item)}
                        </span>
                        <span className="selftest-launcher-cell-type">
                          {item.item_type === "folder"
                            ? `folder (${folders.byId.get(item.id)?.length ?? 0})`
                            : item.item_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {hotseatItems.length > 0 ? (
            <div className="selftest-launcher-hotseat-wrap">
              <div className="selftest-launcher-screen-title">
                {t("selftest.launcher.hotseat")}
              </div>
              <div
                className="selftest-launcher-hotseat"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, layout.hotseat_count, hotseatItems.length)}, minmax(0, 1fr))`,
                }}
              >
                {hotseatItems.map((item) => (
                  <div
                    key={`${item.id}-hotseat-${item.cell_x}`}
                    className={`selftest-launcher-cell is-${item.item_type}`}
                    title={item.component || item.package || item.title}
                  >
                    <span className="selftest-launcher-cell-title">
                      {itemLabel(item)}
                    </span>
                    <span className="selftest-launcher-cell-type">
                      #{item.cell_x}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {folders.headers.length > 0 ? (
            <div className="selftest-launcher-hotseat-wrap">
              <div className="selftest-launcher-screen-title">
                Folders ({folders.headers.length})
              </div>
              <ul className="selftest-launcher-list">
                {folders.headers.map((folder) => {
                  const children = folders.byId.get(folder.id) ?? [];
                  return (
                    <li key={`folder-${folder.id}`}>
                      <span className="selftest-launcher-item-pos">
                        S{folder.screen + 1} ({folder.cell_x},{folder.cell_y})
                      </span>
                      <strong>{itemLabel(folder)}</strong>
                      <span className="selftest-launcher-item-comp">
                        {children.map((c) => itemLabel(c)).join(", ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="selftest-launcher-table-wrap">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("selftest.launcher.filterPlaceholder")}
              aria-label={t("selftest.launcher.filterPlaceholder")}
            />
            <ul className="selftest-launcher-list">
              {filteredItems.map((item) => (
                <li key={`${item.container}-${item.id}-${item.screen}-${item.cell_x}-${item.cell_y}`}>
                  <span className="selftest-launcher-item-pos">
                    {item.container}
                    {item.container === "workspace"
                      ? ` S${item.screen + 1} (${item.cell_x},${item.cell_y}) ${item.span_x}×${item.span_y}`
                      : item.container === "hotseat"
                        ? ` #${item.cell_x}`
                        : item.folder_id
                          ? ` #${item.folder_id}`
                          : ""}
                  </span>
                  <strong>{itemLabel(item)}</strong>
                  <span className="selftest-launcher-item-comp">
                    {item.component || item.package}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
