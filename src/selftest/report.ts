import { t } from "../i18n";
import type {
  SelfTestDiff,
  SelfTestRecord,
  SelfTestSummary,
} from "../api/self_test";

export const FIELD_ORDER = [
  "build",
  "buildtype",
  "tags",
  "android",
  "sdk",
  "firstapi",
  "baseband",
  "gms",
  "patch",
  "vpatch",
  "fingerprint",
  "vfingerprint",
  "baseos",
  "vendor",
  "model",
  "device",
  "manufacturer",
  "soc_vendor",
  "soc_model",
  "builddate",
] as const;

export type FieldKey = (typeof FIELD_ORDER)[number];

export function fieldLabel(key: string): string {
  return FIELD_ORDER.includes(key as FieldKey)
    ? t(`selftest.field.${key}`)
    : key;
}

function code(value: string): string {
  return `\`${value.replace(/\|/g, "\\|").replace(/`/g, "\\`")}\``;
}

type BaselineTarget = {
  id: string;
  serial: string;
  model_code?: string;
  model?: string;
  fields?: Record<string, string>;
};

export function pickSmartBaseline(
  target: BaselineTarget | null,
  all: SelfTestSummary[],
): string {
  if (!target || all.length < 2) return "";
  const others = all.filter((record) => record.id !== target.id);
  if (!others.length) return "";
  const targetModelCode = target.model_code?.trim();
  const targetModel = target.fields?.model ?? target.model;
  const sameModel = others.find(
    (record) =>
      (targetModelCode && record.model_code === targetModelCode) ||
      (targetModel && record.model === targetModel),
  );
  return (
    sameModel ??
    others.find((record) => record.serial === target.serial) ??
    others[0]
  ).id;
}

export function recordMarkdown(record: SelfTestRecord): string {
  const header = `# ${record.fields.model ?? ""} · ${record.fields.build ?? ""}`;
  const meta = [
    `- Serial: \`${record.serial}\``,
    `- Collected: ${record.collected_at}`,
    `- Model/OTA: ${record.model_code || "-"} / ${record.ota_version || "-"}`,
    `- Verdict: ${t(`selftest.verdict.${record.verdict}`)}`,
    ...(record.note ? [`- Note: ${record.note}`] : []),
  ];
  const table = [
    "| Field | Value |",
    "| --- | --- |",
    ...FIELD_ORDER.map((key) => {
      const value = record.fields[key] ?? "(not set)";
      return `| ${fieldLabel(key)} | ${code(value)} |`;
    }),
  ];
  const sections = [header, "", ...meta, "", ...table];
  if (record.launcher_layout) {
    const layout = record.launcher_layout;
    sections.push(
      "",
      "## Launcher Layout",
      `- Launcher: ${layout.default_launcher || layout.launcher_package || "-"}`,
      `- Grid: ${layout.grid_columns}x${layout.grid_rows} (hotseat ${layout.hotseat_count})`,
      `- Display: ${layout.display_size || "-"} @ ${layout.display_density || "-"}dpi`,
    );
    const byScreen = new Map<number, string[]>();
    for (const item of layout.items) {
      if (item.container !== "workspace") continue;
      const list = byScreen.get(item.screen) ?? [];
      const label =
        item.title || item.package || item.component || `#${item.id}`;
      list.push(
        `${label} (${item.cell_x},${item.cell_y} ${item.span_x}x${item.span_y})`,
      );
      byScreen.set(item.screen, list);
    }
    for (const [screen, items] of [...byScreen.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      sections.push(`- Screen ${screen + 1}: ${items.join(", ")}`);
    }
  }
  return sections.join("\n");
}

export function diffMarkdown(
  target: SelfTestRecord,
  diff: SelfTestDiff,
  records: SelfTestSummary[],
): string {
  const base = records.find((record) => record.id === diff.left_id);
  const lines = [
    `# ${t("selftest.md.diffTitle", {
      left: base?.build ?? diff.left_id,
      right: target.fields.build ?? diff.right_id,
    })}`,
    `- ${t("selftest.md.base")}: ${base?.model_code || base?.model || ""} ${base?.ota_version || ""} (${diff.left_id})`,
    `- ${t("selftest.md.target")}: ${target.model_code || target.fields.model || ""} ${target.ota_version || ""} (${diff.right_id})`,
    "",
  ];

  if (diff.field_changes.length) {
    lines.push(
      `## ${t("selftest.md.fields")}`,
      `| ${t("selftest.md.field")} | ${t("selftest.md.baseColumn")} | ${t("selftest.md.targetColumn")} |`,
      "| --- | --- | --- |",
    );
    for (const change of diff.field_changes) {
      lines.push(
        `| ${fieldLabel(change.key)} | ${code(change.left)} | ${code(change.right)} |`,
      );
    }
    lines.push("");
  }

  if (diff.drm_facts_added.length || diff.drm_facts_removed.length) {
    lines.push(`## ${t("selftest.md.drm")}`);
    for (const item of diff.drm_facts_added) lines.push(`- + ${item}`);
    for (const item of diff.drm_facts_removed) lines.push(`- - ${item}`);
    lines.push("");
  }

  if (diff.packages_added.length || diff.packages_removed.length) {
    lines.push(
      `## ${t("selftest.md.packages", {
        added: diff.packages_added.length,
        removed: diff.packages_removed.length,
      })}`,
    );
    for (const item of diff.packages_added) lines.push(`- + ${item}`);
    for (const item of diff.packages_removed) lines.push(`- - ${item}`);
    lines.push("");
  }

  if (diff.features_added.length || diff.features_removed.length) {
    lines.push(
      `## ${t("selftest.md.features", {
        added: diff.features_added.length,
        removed: diff.features_removed.length,
      })}`,
    );
    for (const item of diff.features_added) lines.push(`- + ${item}`);
    for (const item of diff.features_removed) lines.push(`- - ${item}`);
  }

  return lines.join("\n");
}
