/**
 * Recap field → standard number mapping: the pure parts of the staff screen.
 *
 * Spark's standard numbers (consumers sampled, units sold, willing to buy…)
 * come from recap fields. Until a person confirms a field, Spark goes by the
 * field's wording; once confirmed, the confirmation wins. The server owns the
 * rules and re-checks everything on save — these helpers only decide what the
 * screen shows while someone is choosing.
 */

export type MappingField = {
  fieldId: string;
  name: string;
  fieldType: string;
  section: string;
  /** What the wording match counts this field as today. */
  currentMetric: string | null;
  /** Staff's saved decision; null = not confirmed. */
  confirmedMetric: string | null;
  packSize: number | null;
  confirmedBy: string;
  confirmedAt: string | null;
  /** False for a field a count cannot be read from. */
  canCount: boolean;
};

export type MetricOption = { key: string; label: string };

export type MetricSuggestion = {
  fieldId: string;
  metric: string;
  packSize: number | null;
  reason: string;
};

/** One dropdown's state. `metric` "" means "not confirmed". */
export type DraftEntry = { metric: string; packSize: string };
export type MappingDraft = Record<string, DraftEntry>;

export type MappingInput = {
  fieldId: string;
  metric: string | null;
  packSize: number | null;
};

export const NOT_CONFIRMED = "";
export const NOT_A_STANDARD_NUMBER = "none";
const PACK_METRIC = "units_sold_pack";
const SOLD_METRICS = ["units_sold_single", PACK_METRIC];
const MAX_PACK_SIZE = 1000;

/** The numbers a client sees, in the order the warning lists them. */
const STANDARD_NUMBERS: { key: string; label: string; metrics: string[] }[] = [
  { key: "consumers_sampled", label: "Consumers sampled", metrics: ["consumers_sampled"] },
  { key: "units_sold", label: "Units sold", metrics: SOLD_METRICS },
  { key: "willing_to_buy", label: "Willing to buy", metrics: ["willing_to_buy"] },
  { key: "first_time", label: "First-time consumers", metrics: ["first_time"] },
  { key: "brand_aware", label: "Knew the brand", metrics: ["brand_aware"] },
  { key: "samples_given", label: "Samples given out", metrics: ["samples_given"] },
];

export function isCountMetric(metric: string): boolean {
  return metric !== NOT_CONFIRMED && metric !== NOT_A_STANDARD_NUMBER;
}

export function metricLabel(
  metric: string | null | undefined,
  options: readonly MetricOption[],
): string {
  if (!metric) return "Nothing";
  if (metric === NOT_A_STANDARD_NUMBER) return "Nothing";
  return options.find((o) => o.key === metric)?.label ?? metric;
}

export function draftFromFields(fields: readonly MappingField[]): MappingDraft {
  const draft: MappingDraft = {};
  for (const f of fields) {
    draft[f.fieldId] = {
      metric: f.confirmedMetric ?? NOT_CONFIRMED,
      packSize: f.packSize != null ? String(f.packSize) : "",
    };
  }
  return draft;
}

/** A count can only be read from a field that holds one. */
export function optionAllowed(field: MappingField, metric: string): boolean {
  return field.canCount || !isCountMetric(metric);
}

function parsePackSize(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= MAX_PACK_SIZE ? n : null;
}

/** Take a suggestion into the draft. Nothing is saved by this. */
export function applySuggestion(
  draft: MappingDraft,
  field: MappingField,
  suggestion: MetricSuggestion,
): MappingDraft {
  if (!optionAllowed(field, suggestion.metric)) return draft;
  return {
    ...draft,
    [field.fieldId]: {
      metric: suggestion.metric,
      packSize:
        suggestion.metric === PACK_METRIC && suggestion.packSize != null
          ? String(suggestion.packSize)
          : "",
    },
  };
}

export function applyAllSuggestions(
  draft: MappingDraft,
  fields: readonly MappingField[],
  suggestions: readonly MetricSuggestion[],
): MappingDraft {
  const byId = new Map(suggestions.map((s) => [s.fieldId, s]));
  let next = draft;
  for (const field of fields) {
    const s = byId.get(field.fieldId);
    if (s) next = applySuggestion(next, field, s);
  }
  return next;
}

/** Only the fields whose choice differs from what is saved. */
export function changedInputs(
  fields: readonly MappingField[],
  draft: MappingDraft,
): MappingInput[] {
  const out: MappingInput[] = [];
  for (const f of fields) {
    const entry = draft[f.fieldId];
    if (!entry) continue;
    const metric = entry.metric || null;
    const packSize = metric === PACK_METRIC ? parsePackSize(entry.packSize) : null;
    const savedPack = f.confirmedMetric === PACK_METRIC ? f.packSize : null;
    if (metric === f.confirmedMetric && packSize === savedPack) continue;
    out.push({ fieldId: f.fieldId, metric, packSize });
  }
  return out;
}

/** What a field would count as with the draft applied. */
export function countedAs(field: MappingField, entry: DraftEntry | undefined): string | null {
  const chosen = entry?.metric ?? NOT_CONFIRMED;
  if (chosen === NOT_CONFIRMED) return field.currentMetric;
  return chosen === NOT_A_STANDARD_NUMBER ? null : chosen;
}

/**
 * Standard numbers with no field, with the draft applied — what a client
 * would see as "—". Samples fall back to consumers sampled (or to the
 * template's product rows), so they are only missing when both are.
 */
export function missingStandardNumbers(
  fields: readonly MappingField[],
  draft: MappingDraft,
  opts: { tracksProductSamples: boolean },
): MetricOption[] {
  const covered = new Set<string>();
  for (const f of fields) {
    const metric = countedAs(f, draft[f.fieldId]);
    if (metric) covered.add(metric);
  }
  const missing: MetricOption[] = [];
  for (const n of STANDARD_NUMBERS) {
    if (n.metrics.some((m) => covered.has(m))) continue;
    if (
      n.key === "samples_given" &&
      (covered.has("consumers_sampled") || opts.tracksProductSamples)
    ) {
      continue;
    }
    missing.push({ key: n.key, label: n.label });
  }
  return missing;
}

/**
 * The first reason the draft cannot be saved, or null. The server checks
 * the same rules; this only saves a round trip.
 */
export function draftProblem(
  fields: readonly MappingField[],
  draft: MappingDraft,
  options: readonly MetricOption[],
): string | null {
  const seen = new Map<string, string>();
  for (const f of fields) {
    const entry = draft[f.fieldId];
    const metric = entry?.metric ?? NOT_CONFIRMED;
    if (!isCountMetric(metric)) continue;
    if (!f.canCount) {
      return `“${f.name}” does not hold a number, so it cannot be counted.`;
    }
    if (metric === PACK_METRIC) {
      if (entry.packSize.trim() && parsePackSize(entry.packSize) == null) {
        return `Units per pack for “${f.name}” must be a whole number from 1 to ${MAX_PACK_SIZE}.`;
      }
      continue;
    }
    if (SOLD_METRICS.includes(metric)) continue;
    const first = seen.get(metric);
    if (first) {
      return `Only one field can be ${metricLabel(metric, options).toLowerCase()}: “${first}” and “${f.name}” are both set to it.`;
    }
    seen.set(metric, f.name);
  }
  return null;
}

/** "Confirmed by Sam Lee on Nov 15, 2026", or "" when not confirmed. */
export function confirmedNote(field: MappingField): string {
  if (!field.confirmedMetric) return "";
  const who = field.confirmedBy ? ` by ${field.confirmedBy}` : "";
  let when = "";
  if (field.confirmedAt) {
    const d = new Date(field.confirmedAt);
    if (!Number.isNaN(d.getTime())) {
      when = ` on ${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
  }
  return `Confirmed${who}${when}`;
}
