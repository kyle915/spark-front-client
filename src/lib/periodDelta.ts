/**
 * Honest period-over-period deltas for Spark Insights / Program KPIs.
 *
 * Raw MoM % off a near-zero base (or after a collection-method change /
 * bulk import) routinely prints as 2000%+ and destroys trust in every
 * other number on the page. This helper suppresses sparse baselines and
 * caps absurd swings instead of inventing fake precision.
 */

/** Absolute % move beyond this is treated as unreliable / non-organic. */
export const ABSURD_PCT_THRESHOLD = 500;

/**
 * Prior-period floor: below this AND a large ratio, the base is too
 * sparse for a meaningful percentage (e.g. 2 → 80).
 */
export const SPARSE_PREV_MAX = 20;

/** Ratio (current / previous) above this with a sparse prior → n/a. */
export const SPARSE_RATIO_THRESHOLD = 10;

export type PeriodDelta =
  | { kind: "up" | "down" | "flat"; pct: number }
  | { kind: "new" }
  | { kind: "none" }
  | {
      kind: "sparse";
      /** Short chip label */
      label: string;
      note: string;
    }
  | {
      kind: "large";
      direction: "up" | "down";
      /** Capped display percent (always ABSURD_PCT_THRESHOLD). */
      cappedPct: number;
      /** Raw rounded percent, for tests / debugging — not shown. */
      rawPct: number;
      note: string;
    };

const LARGE_NOTE =
  "Large change — may reflect new collection, not organic growth";

const SPARSE_NOTE = "n/a — base period sparse / collection changed";

/**
 * Period-over-period delta with honesty gating.
 *
 * - prev == 0 && cur > 0 → "New"
 * - both 0 → none
 * - sparse prior + huge ratio → suppress % ("n/a")
 * - |pct| > 500 → cap chip at >500% and annotate
 * - otherwise normal up / down / flat with rounded %
 */
export function computePeriodDelta(cur: number, prev: number): PeriodDelta {
  if (prev <= 0) {
    if (cur > 0) return { kind: "new" };
    return { kind: "none" };
  }

  const pct = Math.round(((cur - prev) / prev) * 100);
  const ratio = cur / prev;

  // Near-zero prior with a huge jump — not a trustworthy growth rate.
  if (
    prev <= SPARSE_PREV_MAX &&
    ratio >= SPARSE_RATIO_THRESHOLD &&
    cur > prev
  ) {
    return {
      kind: "sparse",
      label: "n/a",
      note: SPARSE_NOTE,
    };
  }

  if (Math.abs(pct) > ABSURD_PCT_THRESHOLD) {
    return {
      kind: "large",
      direction: pct > 0 ? "up" : "down",
      cappedPct: ABSURD_PCT_THRESHOLD,
      rawPct: pct,
      note: LARGE_NOTE,
    };
  }

  if (pct > 0) return { kind: "up", pct };
  if (pct < 0) return { kind: "down", pct };
  return { kind: "flat", pct: 0 };
}

/** Optional footnote under a comparison tile when the delta is gated. */
export function periodDeltaNote(delta: PeriodDelta): string | null {
  if (delta.kind === "sparse" || delta.kind === "large") return delta.note;
  return null;
}

/** Short chip / change label for MetricCard and legacy dashboards. */
export function formatPeriodDeltaLabel(delta: PeriodDelta): string {
  switch (delta.kind) {
    case "up":
      return `↑ ${delta.pct}%`;
    case "down":
      return `↓ ${Math.abs(delta.pct)}%`;
    case "flat":
      return "→ 0%";
    case "new":
      return "New";
    case "none":
      return "—";
    case "sparse":
      return delta.label;
    case "large":
      return delta.direction === "up"
        ? `↑ >${delta.cappedPct}%`
        : `↓ >${delta.cappedPct}%`;
    default: {
      const _exhaustive: never = delta;
      return _exhaustive;
    }
  }
}

/**
 * Change in a rate (conversion, trial %) between two periods — always in
 * percentage points, never a relative %. `sparseNote` is the API's shared
 * recap-count rule (`SPARSE_BASE_MIN_RECAPS` on either side); when it is
 * set the change is hidden and the note says why.
 */
export type RateDelta =
  | { kind: "pts"; pts: number }
  | { kind: "sparse"; note: string }
  | { kind: "none" };

export function computeRateDelta(
  cur: number | null | undefined,
  prev: number | null | undefined,
  sparseNote: string | null | undefined,
): RateDelta {
  if (sparseNote) return { kind: "sparse", note: sparseNote };
  if (cur == null || prev == null) return { kind: "none" };
  return { kind: "pts", pts: Math.round((cur - prev) * 10) / 10 };
}

/** "+1.4 pts" / "-0.3 pts" / "+0.0 pts"; "n/a" when hidden or not comparable. */
export function formatRateDeltaLabel(delta: RateDelta): string {
  if (delta.kind !== "pts") return "n/a";
  return delta.pts < 0
    ? `${delta.pts.toFixed(1)} pts`
    : `+${delta.pts.toFixed(1)} pts`;
}

/** Whether the delta should use the orange (down / caution) tone. */
export function periodDeltaIsNegative(delta: PeriodDelta): boolean {
  return (
    delta.kind === "down" ||
    (delta.kind === "large" && delta.direction === "down")
  );
}
