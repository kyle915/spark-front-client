/**
 * Activation-type buckets — mirrors spark-api
 * `recaps.tenant_overview._activation_bucket_for_type_name` so Recaps /
 * Insights labels stay aligned with SQL rollups.
 *
 * Order matters: Retail → On-premise → Events → Other.
 */

export type ActivationBucketKey = "retail" | "onprem" | "event" | "other";

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
