/**
 * Activation-type buckets — mirrors spark-api
 * `recaps.tenant_overview._activation_bucket_for_type_name` so Recaps /
 * Insights labels stay aligned with SQL rollups.
 *
 * Order matters: Seeding → Retail → On-premise → Events → Other.
 * Seeding is checked first so "Product Seeding" never matches Event
 * via "activation" substrings.
 */

export type ActivationBucketKey =
  | "retail"
  | "onprem"
  | "event"
  | "seeding"
  | "other";

/**
 * Recap type — spark-api `recaps.recap_types` (template → program → event
 * program → request type; unknown is retail). Each list row carries it as
 * `recapType`.
 */
export type RecapTypeKey =
  | "retail"
  | "onprem"
  | "event"
  | "guerilla"
  | "seeding";

/** Recaps list type chip (`?activation=`). */
export type RecapActivationFilter = "all" | RecapTypeKey;

const RECAP_TYPE_KEYS: ReadonlySet<string> = new Set<RecapTypeKey>([
  "retail",
  "onprem",
  "event",
  "guerilla",
  "seeding",
]);

export function isRecapTypeKey(value: unknown): value is RecapTypeKey {
  return typeof value === "string" && RECAP_TYPE_KEYS.has(value);
}

const BUCKETS: { key: ActivationBucketKey; pattern: RegExp }[] = [
  { key: "retail", pattern: /retail/i },
  { key: "onprem", pattern: /on[-\s]?prem|bar|venue/i },
  { key: "event", pattern: /event|activation|festival|pop[-\s]?up/i },
];

/** Map a request-type / template name onto one activation bucket. */
export function activationBucketForTypeName(
  name: string | null | undefined,
): ActivationBucketKey {
  const text = name ?? "";
  // Product Seeding before Event — "…Product Seeding…" must not match
  // "activation" / event patterns.
  if (/product\s*seeding|\bseeding\b/i.test(text)) return "seeding";
  for (const { key, pattern } of BUCKETS) {
    if (pattern.test(text)) return key;
  }
  return "other";
}

/**
 * CONV (sold ÷ eng) is a retail / on-premise sampling metric.
 * Event activations, Product Seeding, and unclassified types are excluded.
 */
export function countsTowardConversion(
  requestType: string | null | undefined,
): boolean {
  const key = activationBucketForTypeName(requestType);
  return key === "retail" || key === "onprem";
}

/** Same CONV rule keyed by the server recap type. */
export function recapTypeCountsTowardConversion(type: RecapTypeKey): boolean {
  return type === "retail" || type === "onprem";
}

/**
 * A row's recap type: the server's `recapType`, else a name-based guess
 * (unknown is retail, like the server).
 */
export function recapTypeForRow(
  recapType: string | null | undefined,
  typeName: string | null | undefined,
): RecapTypeKey {
  if (isRecapTypeKey(recapType)) return recapType;
  if (/guerr?ill?a/i.test(typeName ?? "")) return "guerilla";
  const bucket = activationBucketForTypeName(typeName);
  return bucket === "other" ? "retail" : bucket;
}

/** Normalize `?activation=` from the Recaps list URL. */
export function normalizeRecapActivationFilter(
  value?: string | null,
): RecapActivationFilter {
  return isRecapTypeKey(value) ? value : "all";
}

/** Client-side match for the Recaps list type chip. */
export function recapMatchesActivationFilter(
  recapType: RecapTypeKey,
  filter: RecapActivationFilter,
): boolean {
  return filter === "all" || recapType === filter;
}

/** Human label for the active type chip / filter pill. */
export function recapActivationFilterLabel(
  filter: RecapActivationFilter,
): string {
  switch (filter) {
    case "all":
      return "All";
    case "retail":
      return "Retail";
    case "onprem":
      return "On-Premise";
    case "event":
      return "Event";
    case "guerilla":
      return "Guerilla";
    case "seeding":
      return "Seeding";
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}
