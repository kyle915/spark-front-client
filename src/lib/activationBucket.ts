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

/** Recaps list chip: Retail (includes On-prem) / Event / Product Seeding / View all. */
export type RecapActivationFilter = "all" | "retail" | "event" | "seeding";

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

/** Normalize `?activation=` from the Recaps list URL. */
export function normalizeRecapActivationFilter(
  value?: string | null,
): RecapActivationFilter {
  if (value === "retail" || value === "event" || value === "seeding") {
    return value;
  }
  return "all";
}

/**
 * Client-side match for the Recaps list activation chip.
 * Retail folds On-premise in (same as server `activationBucket=retail`).
 */
export function recapMatchesActivationFilter(
  requestType: string | null | undefined,
  filter: RecapActivationFilter,
): boolean {
  if (filter === "all") return true;
  const key = activationBucketForTypeName(requestType);
  switch (filter) {
    case "retail":
      return key === "retail" || key === "onprem";
    case "event":
      return key === "event";
    case "seeding":
      return key === "seeding";
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

/** Human label for the active activation chip / filter pill. */
export function recapActivationFilterLabel(
  filter: RecapActivationFilter,
): string {
  switch (filter) {
    case "all":
      return "View all";
    case "retail":
      return "Retail";
    case "event":
      return "Event";
    case "seeding":
      return "Product Seeding";
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}
