import type { DrmColumn, XlsxOptions } from "./api/self_test";
import { FIELD_ORDER } from "./selftest/report";

const STORAGE_KEY = "spm.selftest.preferences.v1";

export const RECORD_TAGS = [
  "checks",
  "soc",
  "verdict",
  "android",
  "review",
  "tags",
] as const;
type RecordTag = (typeof RECORD_TAGS)[number];
export type RecordTagVisibility = Record<RecordTag, boolean>;

const METADATA_FIELDS = [
  "@id",
  "@name",
  "@collected_at",
  "@serial",
  "@test_type",
  "@model_code",
  "@ota_version",
  "@baseline_id",
  "@patch_reference",
  "@patch_valid_days",
  "@verdict",
  "@tags",
  "@note",
] as const;
export type ExportField =
  (typeof METADATA_FIELDS)[number] | (typeof FIELD_ORDER)[number];
export type OrderedField<T> = { key: T; enabled: boolean };
export type XlsxPreferences = {
  filename: string;
  sheetNames: XlsxOptions["sheetNames"];
  fields: OrderedField<ExportField>[];
  drmColumns: OrderedField<DrmColumn>[];
};

export const DEFAULT_RECORD_TAGS: RecordTagVisibility = {
  checks: true,
  soc: true,
  verdict: true,
  android: true,
  review: true,
  tags: true,
};
export const DEFAULT_XLSX: XlsxPreferences = {
  filename: "",
  sheetNames: ["", "", "", ""],
  fields: [...METADATA_FIELDS, ...FIELD_ORDER].map((key) => ({
    key,
    enabled: true,
  })),
  drmColumns: [
    { key: "section", enabled: true },
    { key: "content", enabled: true },
  ],
};

type Preferences = {
  railCollapsed: boolean;
  guideDismissed: boolean;
  recordTags: RecordTagVisibility;
  xlsx: XlsxPreferences;
  pinnedIds: string[];
  lastDetailTab: string;
  diffChangedOnly: boolean;
  sidebarDensity: "comfortable" | "compact";
};

const DEFAULT: Preferences = {
  railCollapsed: false,
  guideDismissed: false,
  recordTags: DEFAULT_RECORD_TAGS,
  xlsx: DEFAULT_XLSX,
  pinnedIds: [],
  lastDetailTab: "gms",
  diffChangedOnly: false,
  sidebarDensity: "comfortable",
};

function readOrder<T extends string>(
  stored: OrderedField<T>[] | undefined,
  defaults: OrderedField<T>[],
): OrderedField<T>[] {
  if (!Array.isArray(stored)) return defaults;
  const remaining = new Map(defaults.map((field) => [field.key, field]));
  const fields: OrderedField<T>[] = [];
  for (const field of stored) {
    if (remaining.delete(field?.key)) {
      fields.push({ key: field.key, enabled: field.enabled !== false });
    }
  }
  return [...fields, ...remaining.values()];
}

export function readPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const names = parsed.xlsx?.sheetNames;
    const nameAt = (index: number) =>
      Array.isArray(names) && typeof names[index] === "string"
        ? names[index]
        : "";
    return {
      railCollapsed: Boolean(parsed.railCollapsed),
      guideDismissed: Boolean(parsed.guideDismissed),
      recordTags: { ...DEFAULT_RECORD_TAGS, ...parsed.recordTags },
      xlsx: {
        filename:
          typeof parsed.xlsx?.filename === "string" ? parsed.xlsx.filename : "",
        sheetNames: [nameAt(0), nameAt(1), nameAt(2), nameAt(3)],
        fields: readOrder(parsed.xlsx?.fields, DEFAULT_XLSX.fields),
        drmColumns: readOrder(parsed.xlsx?.drmColumns, DEFAULT_XLSX.drmColumns),
      },
      pinnedIds: Array.isArray(parsed.pinnedIds)
        ? parsed.pinnedIds.filter((id): id is string => typeof id === "string")
        : [],
      lastDetailTab:
        typeof parsed.lastDetailTab === "string" ? parsed.lastDetailTab : "gms",
      diffChangedOnly: Boolean(parsed.diffChangedOnly),
      sidebarDensity:
        parsed.sidebarDensity === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULT;
  }
}

export function savePreferences(changes: Partial<Preferences>) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readPreferences(), ...changes }),
    );
  } catch {}
}
