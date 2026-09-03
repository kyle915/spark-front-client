/**
 * Activation-type buckets — mirrors spark-api
 * `recaps.tenant_overview._activation_bucket_for_type_name` so Recaps /
 * Insights labels stay aligned with SQL rollups.
 *
 * Order matters: Retail → On-premise → Events → Other.
 */

export type ActivationBucketKey = "retail" | "onprem" | "event" | "other";

/** Recaps list chip: Retail (includes On-prem) / Event / View all. */
export type RecapActivationFilter = "all" | "retail" | "event";

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
  // Product Seeding (and similar) must NOT fall into Event via "activation"
  // substrings — keep unclassified so Recaps chips only show them under
  // View all. Name check first so "…Product Seeding…" never matches later.
  if (/product\s*seeding|\bseeding\b/i.test(text)) return "other";
  for (const { key, pattern } of BUCKETS) {
    if (pattern.test(text)) return key;
  }
  return "other";
}

/**
 * CONV (sold ÷ eng) is a retail / on-premise sampling metric.
 * Event activations and unclassified types are excluded.
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
  if (value === "retail" || value === "event") return value;
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
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}
