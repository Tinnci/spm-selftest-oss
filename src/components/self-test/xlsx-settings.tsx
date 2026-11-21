import { useId, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SettingsGroup } from "@/components/settings-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import {
  DEFAULT_XLSX,
  type OrderedField,
  type XlsxPreferences,
} from "@/preferences";
import { fieldLabel } from "@/selftest/report";

const SHEETS = ["gms", "drm", "packages", "features"] as const;

function OrderedFields<T extends string>({
  fields,
  labelFor,
  onChange,
}: {
  fields: OrderedField<T>[];
  labelFor: (key: T) => string;
  onChange: (fields: OrderedField<T>[]) => void;
}) {
  const move = (from: number, step: number) => {
    const to = from + step;
    const next = [...fields];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <ol className="settings-field-order">
      {fields.map(({ key, enabled }, index) => {
        const label = labelFor(key);
        return (
          <li key={key}>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => {
                  const checked = event.target.checked;
                  onChange(
                    fields.map((field) =>
                      field.key === key ? { key, enabled: checked } : field,
                    ),
                  );
                }}
              />
              {label}
            </label>
            <div className="settings-order-actions">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={index === 0}
                aria-label={t("settings.xlsx.moveUp", { field: label })}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={index === fields.length - 1}
                aria-label={t("settings.xlsx.moveDown", { field: label })}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function XlsxSettings({
  value,
  onSave,
}: {
  value: XlsxPreferences;
  onSave: (value: XlsxPreferences) => void;
}) {
  const [draft, setDraft] = useState(value);
  const hintId = useId();
  const errorId = useId();
  const defaults = SHEETS.map((key) => t("settings.xlsx.sheet." + key));
  const names = draft.sheetNames.map(
    (name, index) => name.trim() || defaults[index],
  );
  const invalidSheetNames =
    names.some(
      (name) =>
        [...name].length > 31 ||
        [...name].some((character) => "[]:*?/\\".includes(character)) ||
        name.startsWith("'") ||
        name.endsWith("'") ||
        name.toLowerCase() === "history",
    ) || new Set(names.map((name) => name.toLowerCase())).size !== names.length;
  const missingDrmColumn = !draft.drmColumns.some((field) => field.enabled);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  return (
    <form
      className="settings-section"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !invalidSheetNames && !missingDrmColumn) onSave(draft);
      }}
    >
      <label className="settings-row">
        <span>{t("settings.xlsx.filename")}</span>
        <Input
          value={draft.filename}
          aria-describedby={hintId}
          placeholder="self-test-{model}-{id}.xlsx"
          maxLength={160}
          onChange={(event) =>
            setDraft({ ...draft, filename: event.target.value })
          }
        />
      </label>
      <p id={hintId} className="quiet settings-note">
        {t("settings.xlsx.filenameHint")}
      </p>
      <div className="settings-row">
        <span>{t("settings.xlsx.sheetNames")}</span>
        <div className="settings-sheet-names">
          {defaults.map((name, index) => (
            <label className="settings-sheet-name" key={SHEETS[index]}>
              <span>{name}</span>
              <Input
                value={draft.sheetNames[index]}
                placeholder={t("settings.xlsx.defaultSheetName")}
                aria-invalid={invalidSheetNames || undefined}
                aria-describedby={invalidSheetNames ? errorId : undefined}
                onChange={(event) => {
                  const sheetNames: XlsxPreferences["sheetNames"] = [
                    ...draft.sheetNames,
                  ];
                  sheetNames[index] = event.target.value;
                  setDraft({ ...draft, sheetNames });
                }}
              />
            </label>
          ))}
          {invalidSheetNames ? (
            <p id={errorId} className="settings-field-error" role="alert">
              {t("settings.xlsx.invalidSheetNames")}
            </p>
          ) : null}
        </div>
      </div>
      <SettingsGroup title={t("settings.xlsx.gmsFields")}>
        <OrderedFields
          fields={draft.fields}
          labelFor={(key) =>
            key.startsWith("@")
              ? t("settings.xlsx.field." + key.slice(1))
              : fieldLabel(key)
          }
          onChange={(fields) => setDraft({ ...draft, fields })}
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.xlsx.drmColumns")}>
        <OrderedFields
          fields={draft.drmColumns}
          labelFor={(key) => t("settings.xlsx.drm." + key)}
          onChange={(drmColumns) => setDraft({ ...draft, drmColumns })}
        />
        {missingDrmColumn ? (
          <p className="settings-field-error" role="alert">
            {t("settings.xlsx.missingDrmColumn")}
          </p>
        ) : null}
      </SettingsGroup>
      <div className="settings-actions settings-xlsx-actions">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDraft(DEFAULT_XLSX)}
        >
          {t("settings.xlsx.reset")}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!dirty || invalidSheetNames || missingDrmColumn}
        >
          {t("settings.xlsx.save")}
        </Button>
      </div>
    </form>
  );
}
