import { ArrowLeftRight, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  SelfTestDiff,
  SelfTestRecord,
  SelfTestSummary,
} from "@/api/self_test";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/ui/highlight-text";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { useCopyWithToast } from "@/hooks/useCopyWithToast";

export type DiffScope = "all" | "fields" | "packages" | "features" | "drm";

type DiffCounts = {
  fields: number;
  packages: number;
  features: number;
  drm: number;
};

export function DiffPanel({
  detail,
  baselineRecord,
  compareId,
  setCompareId,
  compareCandidates,
  diff,
  diffLoading,
  diffTotal,
  diffCounts,
  diffScope,
  setDiffScope,
  diffFilter,
  setDiffFilter,
  changedOnly = false,
  onToggleChangedOnly,
  shownFieldChanges,
  shownDrmAdded,
  shownDrmRemoved,
  shownPkgsAdded,
  shownPkgsRemoved,
  shownFeatsAdded,
  shownFeatsRemoved,
  shownPkgsSame,
  shownFeatsSame,
  handleSwapDiff,
  handleCopyDiffMarkdown,
}: {
  detail: SelfTestRecord;
  baselineRecord?: SelfTestSummary;
  compareId: string;
  setCompareId: (value: string) => void;
  compareCandidates: SelfTestSummary[];
  diff: SelfTestDiff | null;
  diffLoading: boolean;
  diffTotal: number;
  diffCounts: DiffCounts;
  diffScope: DiffScope;
  setDiffScope: (scope: DiffScope) => void;
  diffFilter: string;
  setDiffFilter: (value: string) => void;
  changedOnly?: boolean;
  onToggleChangedOnly?: () => void;
  shownFieldChanges: SelfTestDiff["field_changes"];
  shownDrmAdded: string[];
  shownDrmRemoved: string[];
  shownPkgsAdded: string[];
  shownPkgsRemoved: string[];
  shownFeatsAdded: string[];
  shownFeatsRemoved: string[];
  shownPkgsSame: string[];
  shownFeatsSame: string[];
  handleSwapDiff: () => void;
  handleCopyDiffMarkdown: () => void;
}) {
  const { t } = useTranslation();
  const copyWithToast = useCopyWithToast();
  const visibleKeyFields = diff
    ? changedOnly
      ? diff.key_fields.filter((f) => f.left !== f.right)
      : diff.key_fields
    : [];
  return (
    <div
      className="selftest-diff-pane"
      role="tabpanel"
      id="selftest-panel-diff"
      aria-labelledby="selftest-tab-diff"
      tabIndex={0}
    >
      <div className="selftest-diff-pair">
        <div className="selftest-diff-side">
          <span className="selftest-diff-role">
            {t("selftest.diffBaseline")}
          </span>
          <strong>{baselineRecord?.name || t("selftest.compareNone")}</strong>
          {baselineRecord ? (
            <span className="quiet">
              {baselineRecord.build} ·{" "}
              {baselineRecord.collected_at.slice(0, 10)}
            </span>
          ) : null}
        </div>
        <ArrowLeftRight className="selftest-diff-arrow" aria-hidden="true" />
        <div className="selftest-diff-side is-target">
          <span className="selftest-diff-role">{t("selftest.diffTarget")}</span>
          <strong>{detail.name || detail.fields.build}</strong>
          <span className="quiet">
            {detail.fields.build} · {detail.collected_at.slice(0, 10)}
          </span>
        </div>
      </div>

      <div className="selftest-diff-controls">
        <select
          className="cal-model-select"
          aria-label={t("selftest.compareWith")}
          value={compareId}
          onChange={(e) => setCompareId(e.target.value)}
        >
          <option value="">{t("selftest.compareNone")}</option>
          {compareCandidates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.model_code || r.model}
              {r.ota_version ? " · " + r.ota_version : ""} · {r.build} (
              {r.collected_at.slice(0, 16).replace("T", " ")})
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          disabled={!compareId || compareId === detail.id}
          onClick={() => void handleSwapDiff()}
        >
          <ArrowLeftRight aria-hidden="true" />
          {t("selftest.swapDiff")}
        </Button>
        {diff ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCopyDiffMarkdown()}
          >
            <Copy aria-hidden="true" />
            {t("selftest.copyDiffMarkdown")}
          </Button>
        ) : null}
      </div>

      {!compareId ? (
        <p className="quiet">{t("selftest.chooseBaseline")}</p>
      ) : diffLoading ? (
        <p className="quiet selftest-loading" role="status">
          <Spinner aria-hidden="true" />
          {t("controls.loading")}
        </p>
      ) : diff ? (
        <>
          <div
            className="selftest-diff-scopes"
            role="group"
            aria-label={t("selftest.diffScopeAll")}
          >
            {(
              [
                {
                  key: "all",
                  label: t("selftest.diffScopeAll"),
                  count: diffTotal,
                },
                {
                  key: "fields",
                  label: t("selftest.diffScopeFields"),
                  count: diffCounts.fields,
                },
                {
                  key: "packages",
                  label: t("selftest.diffScopePkgs"),
                  count: diffCounts.packages,
                },
                {
                  key: "features",
                  label: t("selftest.diffScopeFeats"),
                  count: diffCounts.features,
                },
                {
                  key: "drm",
                  label: t("selftest.diffScopeDrm"),
                  count: diffCounts.drm,
                },
              ] as const
            ).map((scope) => (
              <button
                key={scope.key}
                type="button"
                className={diffScope === scope.key ? "is-active" : ""}
                aria-pressed={diffScope === scope.key}
                onClick={() => setDiffScope(scope.key)}
              >
                {scope.label}
                <span>{scope.count}</span>
              </button>
            ))}
          </div>

          <div className="selftest-diff-toolbar">
            <SearchInput
              value={diffFilter}
              placeholder={t("selftest.diffFilterPlaceholder")}
              ariaLabel={t("selftest.diffFilterPlaceholder")}
              onChange={setDiffFilter}
            />
            {onToggleChangedOnly ? (
              <Button
                type="button"
                variant={changedOnly ? "secondary" : "outline"}
                size="sm"
                className="selftest-diff-changed-only"
                aria-pressed={changedOnly}
                onClick={onToggleChangedOnly}
              >
                {t("selftest.diffChangedOnly")}
              </Button>
            ) : null}
          </div>

          {!shownFieldChanges.length &&
          !shownDrmAdded.length &&
          !shownDrmRemoved.length &&
          !shownPkgsAdded.length &&
          !shownPkgsRemoved.length &&
          !shownFeatsAdded.length &&
          !shownFeatsRemoved.length ? (
            <p className="quiet">
              {diffTotal === 0
                ? t("selftest.diffEmpty")
                : t("selftest.diffScopeEmpty")}
            </p>
          ) : (
            <div className="selftest-diff-sections">
              {visibleKeyFields.length ? (
                <div>
                  <h4>{t("selftest.diffKeyFields")}</h4>
                  <div className="selftest-table-scroll">
                    <table className="selftest-diff-table">
                      <thead>
                        <tr>
                          <th scope="col">{t("selftest.diffFieldColumn")}</th>
                          <th scope="col">{t("selftest.diffBaseline")}</th>
                          <th scope="col">{t("selftest.diffTarget")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleKeyFields.map((field) => {
                          const changed = field.left !== field.right;
                          return (
                            <tr
                              key={field.key}
                              className={changed ? "is-changed" : ""}
                            >
                              <th scope="row">
                                {t(`selftest.field.${field.key}`)}
                              </th>
                              <td>{field.left || "-"}</td>
                              <td className={changed ? "is-after" : ""}>
                                {field.right || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {(diffScope === "all" || diffScope === "fields") &&
              shownFieldChanges.length ? (
                <div>
                  <h4>
                    {t("selftest.diffFields", {
                      count: shownFieldChanges.length,
                    })}
                  </h4>
                  <dl className="selftest-fields">
                    {shownFieldChanges.map((c) => (
                      <div key={c.key} className="selftest-field-row">
                        <dt>
                          <HighlightText
                            text={t(`selftest.field.${c.key}`)}
                            query={diffFilter}
                          />
                        </dt>
                        <dd>
                          <span className="quiet">
                            <HighlightText text={c.left} query={diffFilter} />
                          </span>{" "}
                          →{" "}
                          <strong>
                            <HighlightText text={c.right} query={diffFilter} />
                          </strong>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {(diffScope === "all" || diffScope === "drm") &&
              (shownDrmAdded.length || shownDrmRemoved.length) ? (
                <div>
                  <h4>
                    {t("selftest.diffDrm", {
                      added: shownDrmAdded.length,
                      removed: shownDrmRemoved.length,
                    })}
                  </h4>
                  <ul className="selftest-mono-list">
                    {shownDrmAdded.map((x) => (
                      <li key={`da-${x}`} className="selftest-diff-add">
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(x)}
                        >
                          <span>
                            + <HighlightText text={x} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                    {shownDrmRemoved.map((x) => (
                      <li key={`dr-${x}`} className="selftest-diff-del">
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(x)}
                        >
                          <span>
                            - <HighlightText text={x} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(diffScope === "all" || diffScope === "packages") &&
              shownPkgsAdded.length ? (
                <div>
                  <h4>
                    {t("selftest.diffPkgsAdded", {
                      count: shownPkgsAdded.length,
                    })}
                  </h4>
                  <ul className="selftest-mono-list">
                    {shownPkgsAdded.map((p) => (
                      <li key={p} className="selftest-diff-add">
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(p)}
                        >
                          <span>
                            + <HighlightText text={p} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(diffScope === "all" || diffScope === "packages") &&
              shownPkgsRemoved.length ? (
                <div>
                  <h4>
                    {t("selftest.diffPkgsRemoved", {
                      count: shownPkgsRemoved.length,
                    })}
                  </h4>
                  <ul className="selftest-mono-list">
                    {shownPkgsRemoved.map((p) => (
                      <li key={p} className="selftest-diff-del">
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(p)}
                        >
                          <span>
                            - <HighlightText text={p} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(diffScope === "all" || diffScope === "features") &&
              shownFeatsAdded.length ? (
                <div>
                  <h4>
                    {t("selftest.diffFeatsAdded", {
                      count: shownFeatsAdded.length,
                    })}
                  </h4>
                  <ul className="selftest-mono-list">
                    {shownFeatsAdded.map((f) => (
                      <li key={f} className="selftest-diff-add">
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(f)}
                        >
                          <span>
                            + <HighlightText text={f} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(diffScope === "all" || diffScope === "features") &&
              shownFeatsRemoved.length ? (
                <div>
                  <h4>
                    {t("selftest.diffFeatsRemoved", {
                      count: shownFeatsRemoved.length,
                    })}
                  </h4>
                  <ul className="selftest-mono-list">
                    {shownFeatsRemoved.map((f) => (
                      <li key={f} className="selftest-diff-del">
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(f)}
                        >
                          <span>
                            - <HighlightText text={f} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!changedOnly &&
              (diffScope === "all" || diffScope === "packages") &&
              shownPkgsSame.length ? (
                <details className="selftest-diff-same">
                  <summary>
                    {t("selftest.diffUnchangedPkgs", {
                      count: shownPkgsSame.length,
                    })}
                  </summary>
                  <ul className="selftest-mono-list">
                    {shownPkgsSame.map((entry) => (
                      <li key={entry}>
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(entry)}
                        >
                          <span>
                            <HighlightText text={entry} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {!changedOnly &&
              (diffScope === "all" || diffScope === "features") &&
              shownFeatsSame.length ? (
                <details className="selftest-diff-same">
                  <summary>
                    {t("selftest.diffUnchangedFeats", {
                      count: shownFeatsSame.length,
                    })}
                  </summary>
                  <ul className="selftest-mono-list">
                    {shownFeatsSame.map((entry) => (
                      <li key={entry}>
                        <button
                          type="button"
                          className="selftest-mono-item"
                          onClick={() => void copyWithToast(entry)}
                        >
                          <span>
                            <HighlightText text={entry} query={diffFilter} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
