/**
 * "What Spark counts from this form" — staff only, on the template editor.
 *
 * Each saved field of the template, what Spark counts it as today (by its
 * wording), and a dropdown to confirm or change that. A confirmed field is
 * counted by the confirmation from then on. "Suggest mapping" asks the server
 * for a proposal built from the field labels, types and choice options; the
 * proposal is shown beside each field and does nothing until a person takes
 * it and saves.
 *
 * Above the list: the standard numbers that have no field on this form, so
 * staff see the "—" before the client does.
 */

import { Component, Suspense, useMemo, useState, type ReactNode } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useAlertStore } from "@/store/alertStore";
import { RecapTemplateMetricMappingQuery } from "@/api/queries/RecapTemplateMetricMappingQuery";
import type { RecapTemplateMetricMappingQuery as MappingQueryType } from "@api/queries/__generated__/RecapTemplateMetricMappingQuery.graphql";
import { SuggestRecapMetricMappingMutation } from "@/api/mutations/SuggestRecapMetricMappingMutation";
import type { SuggestRecapMetricMappingMutation as SuggestMutationType } from "@api/mutations/__generated__/SuggestRecapMetricMappingMutation.graphql";
import { SaveRecapMetricMappingMutation } from "@/api/mutations/SaveRecapMetricMappingMutation";
import type { SaveRecapMetricMappingMutation as SaveMutationType } from "@api/mutations/__generated__/SaveRecapMetricMappingMutation.graphql";
import {
  NOT_CONFIRMED,
  applyAllSuggestions,
  applySuggestion,
  changedInputs,
  confirmedNote,
  draftFromFields,
  draftProblem,
  metricLabel,
  missingStandardNumbers,
  optionAllowed,
  type MappingDraft,
  type MappingField,
  type MetricOption,
  type MetricSuggestion,
} from "./metricMapping";

const controlStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "0.5rem 0.7rem",
  color: "var(--spark-text)",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

const quietButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};

type ServerMapping = NonNullable<MappingQueryType["response"]["recapTemplateMetricMapping"]>;

function toFields(mapping: ServerMapping): MappingField[] {
  return mapping.fields.map((f) => ({
    fieldId: String(f.fieldId),
    name: f.name,
    fieldType: f.fieldType,
    section: f.section,
    currentMetric: f.currentMetric ?? null,
    confirmedMetric: f.confirmedMetric ?? null,
    packSize: f.packSize ?? null,
    confirmedBy: f.confirmedBy,
    confirmedAt: f.confirmedAt != null ? String(f.confirmedAt) : null,
    canCount: f.canCount,
  }));
}

const Loaded: React.FC<{
  templateId: string;
  tracksProductSamples: boolean;
}> = ({ templateId, tracksProductSamples }) => {
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<MappingQueryType>(
    RecapTemplateMetricMappingQuery,
    { templateId },
    { fetchPolicy: "network-only" },
  );
  const initial = data.recapTemplateMetricMapping;

  const [fields, setFields] = useState<MappingField[]>(() =>
    initial ? toFields(initial) : [],
  );
  const [savedMissing, setSavedMissing] = useState<MetricOption[]>(() =>
    (initial?.missingMetrics ?? []).map((m) => ({ key: m.key, label: m.label })),
  );
  const options: MetricOption[] = useMemo(
    () => (initial?.metricOptions ?? []).map((o) => ({ key: o.key, label: o.label })),
    [initial],
  );
  const [draft, setDraft] = useState<MappingDraft>(() => draftFromFields(fields));
  const [suggestions, setSuggestions] = useState<Record<string, MetricSuggestion>>({});
  const [suggestNote, setSuggestNote] = useState("");

  const [commitSuggest, isSuggesting] = useMutation<SuggestMutationType>(
    SuggestRecapMetricMappingMutation,
  );
  const [commitSave, isSaving] = useMutation<SaveMutationType>(
    SaveRecapMetricMappingMutation,
  );

  const changes = useMemo(() => changedInputs(fields, draft), [fields, draft]);
  const problem = useMemo(
    () => draftProblem(fields, draft, options),
    [fields, draft, options],
  );
  // The server's list is the truth for what is saved; while someone is
  // choosing, show what the list would be with their choices applied.
  const missing = useMemo(
    () =>
      changes.length === 0
        ? savedMissing
        : missingStandardNumbers(fields, draft, { tracksProductSamples }),
    [changes, savedMissing, fields, draft, tracksProductSamples],
  );

  if (!initial) return null;

  const suggest = () => {
    setSuggestNote("");
    commitSuggest({
      variables: { templateId },
      onCompleted: (resp) => {
        const r = resp.suggestRecapMetricMapping;
        if (!r.ok) {
          setSuggestions({});
          setSuggestNote(
            r.reason || "Suggestions are not available right now. Choose each field by hand.",
          );
          return;
        }
        const next: Record<string, MetricSuggestion> = {};
        for (const s of r.suggestions) {
          next[String(s.fieldId)] = {
            fieldId: String(s.fieldId),
            metric: s.metric,
            packSize: s.packSize ?? null,
            reason: s.reason,
          };
        }
        setSuggestions(next);
        setSuggestNote(
          r.suggestions.length
            ? "Suggestions are shown beside each field. Nothing changes until you save."
            : "No suggestions for this form.",
        );
      },
      onError: () =>
        setSuggestNote(
          "Suggestions are not available right now. Choose each field by hand.",
        ),
    });
  };

  const save = () => {
    if (problem) {
      showAlert(problem, "error");
      return;
    }
    commitSave({
      variables: { templateId, fields: changes },
      onCompleted: (resp) => {
        const r = resp.saveRecapMetricMapping;
        if (!r.ok || !r.mapping) {
          showAlert(r.message || "Couldn't save the mapping.", "error");
          return;
        }
        const nextFields = toFields(r.mapping);
        setFields(nextFields);
        setDraft(draftFromFields(nextFields));
        setSavedMissing(
          r.mapping.missingMetrics.map((m) => ({ key: m.key, label: m.label })),
        );
        showAlert("Mapping saved.", "success");
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const usable = fields.filter((f) => {
    const s = suggestions[f.fieldId];
    return s && optionAllowed(f, s.metric) && draft[f.fieldId]?.metric !== s.metric;
  });

  return (
    <div className="spark-card p-5" aria-label="What Spark counts from this form">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0" style={{ maxWidth: "46rem" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--spark-text)" }}>
            What Spark counts from this form
          </h2>
          <p className="text-[13px] mt-1" style={{ color: "var(--spark-text-secondary)" }}>
            Dashboards and reports take their standard numbers from these fields.
            Until you confirm a field, Spark goes by its wording. A confirmed
            field is counted the way you set it, on every recap filed on this
            form.
          </p>
        </div>
        <button
          type="button"
          onClick={suggest}
          disabled={isSuggesting || fields.length === 0}
          className="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-40"
          style={quietButton}
        >
          {isSuggesting ? "Suggesting…" : "Suggest mapping"}
        </button>
      </div>

      {suggestNote ? (
        <p
          className="text-[13px] mt-3"
          role="status"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {suggestNote}
          {usable.length > 1 ? (
            <>
              {" "}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  setDraft((d) =>
                    applyAllSuggestions(d, fields, Object.values(suggestions)),
                  )
                }
              >
                Use all {usable.length}
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {missing.length > 0 ? (
        <div
          className="mt-4 rounded-xl px-4 py-3"
          role="note"
          style={{
            border: "1px solid var(--spark-flag-ink, #a8340f)",
            background: "transparent",
          }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "var(--spark-flag-ink, #a8340f)" }}>
            These standard numbers have no field on this template
          </p>
          <ul
            className="text-[13px] mt-1 list-disc pl-5"
            style={{ color: "var(--spark-text)" }}
          >
            {missing.map((m) => (
              <li key={m.key}>{m.label}</li>
            ))}
          </ul>
          <p className="text-[12px] mt-1" style={{ color: "var(--spark-text-secondary)" }}>
            A client sees “—” for each of these until a field is set to it.
          </p>
        </div>
      ) : null}

      {fields.length === 0 ? (
        <p className="text-[13px] mt-4" style={{ color: "var(--spark-text-secondary)" }}>
          This template has no saved fields yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {fields.map((f) => {
            const entry = draft[f.fieldId] ?? { metric: NOT_CONFIRMED, packSize: "" };
            const suggestion = suggestions[f.fieldId];
            const note = confirmedNote(f);
            const selectId = `metric-${f.fieldId}`;
            return (
              <li
                key={f.fieldId}
                className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)]"
                style={{
                  padding: "0.75rem",
                  borderRadius: 12,
                  border: "1px solid var(--spark-border)",
                }}
              >
                <div className="min-w-0">
                  <label
                    htmlFor={selectId}
                    className="text-sm font-medium block"
                    style={{ color: "var(--spark-text)", overflowWrap: "anywhere" }}
                  >
                    {f.name}
                  </label>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
                    {[f.fieldType, f.section].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[12px]" style={{ color: "var(--spark-text-meta)" }}>
                    Counts today as
                  </p>
                  <p className="text-[13px]" style={{ color: "var(--spark-text)" }}>
                    {metricLabel(f.confirmedMetric ?? f.currentMetric, options)}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--spark-text-meta)" }}>
                    {note || "By its wording"}
                  </p>
                </div>

                <div className="min-w-0">
                  <select
                    id={selectId}
                    value={entry.metric}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [f.fieldId]: { metric: e.target.value, packSize: entry.packSize },
                      }))
                    }
                    style={controlStyle}
                  >
                    <option value={NOT_CONFIRMED}>Not confirmed (go by wording)</option>
                    {options.map((o) => (
                      <option key={o.key} value={o.key} disabled={!optionAllowed(f, o.key)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {entry.metric === "units_sold_pack" ? (
                    <label className="flex items-center gap-2 mt-2 text-[13px]">
                      <span style={{ color: "var(--spark-text-secondary)" }}>Units per pack</span>
                      <input
                        inputMode="numeric"
                        value={entry.packSize}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [f.fieldId]: { metric: entry.metric, packSize: e.target.value },
                          }))
                        }
                        placeholder="12"
                        style={{ ...controlStyle, width: "5.5rem" }}
                      />
                    </label>
                  ) : null}
                  {!f.canCount ? (
                    <p className="text-[12px] mt-1" style={{ color: "var(--spark-text-meta)" }}>
                      This field does not hold a number, so it cannot be counted.
                    </p>
                  ) : null}
                  {suggestion ? (
                    <p className="text-[12px] mt-1" style={{ color: "var(--spark-text-secondary)" }}>
                      Suggested: {metricLabel(suggestion.metric, options)}
                      {suggestion.metric === "units_sold_pack" && suggestion.packSize
                        ? ` (${suggestion.packSize} per pack)`
                        : ""}
                      {suggestion.reason ? `. ${suggestion.reason}` : ""}{" "}
                      {optionAllowed(f, suggestion.metric) &&
                      entry.metric !== suggestion.metric ? (
                        <button
                          type="button"
                          className="underline"
                          style={{ color: "var(--spark-text)" }}
                          onClick={() => setDraft((d) => applySuggestion(d, f, suggestion))}
                        >
                          Use
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p
          className="text-[13px]"
          role={problem ? "alert" : undefined}
          style={{
            color: problem ? "var(--spark-flag-ink, #a8340f)" : "var(--spark-text-secondary)",
          }}
        >
          {problem ??
            (changes.length > 0
              ? `${changes.length} ${changes.length === 1 ? "change" : "changes"} not saved. Saving changes the numbers clients see for this form.`
              : "Fields you add above appear here once the template is saved.")}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={isSaving || changes.length === 0 || Boolean(problem)}
          className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-40"
          style={quietButton}
        >
          {isSaving ? "Saving…" : "Save mapping"}
        </button>
      </div>
    </div>
  );
};

class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="spark-card p-5">
          <p className="text-[13px]" style={{ color: "var(--spark-text-secondary)" }}>
            Couldn't load what Spark counts from this form. Reload the page to try again.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const RecapMetricMappingCard: React.FC<{
  templateId: string;
  tracksProductSamples: boolean;
}> = ({ templateId, tracksProductSamples }) => (
  <QuietBoundary>
    <Suspense
      fallback={
        <div className="spark-card p-5">
          <p className="text-[13px]" style={{ color: "var(--spark-text-meta)" }}>
            Loading what Spark counts from this form…
          </p>
        </div>
      }
    >
      <Loaded templateId={templateId} tracksProductSamples={tracksProductSamples} />
    </Suspense>
  </QuietBoundary>
);

export default RecapMetricMappingCard;
