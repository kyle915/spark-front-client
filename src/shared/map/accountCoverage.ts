/**
 * Store-coverage classification for the Account Map.
 *
 * Definition (server-computed in events.admin_payloads, mirrored here for
 * display): a roster retailer is Sampled with exactly 1 distinct event
 * that has a filed recap, Repeat with >1, and Never visited with 0.
 * Requests/events alone never make a store Sampled — they are Planned.
 *
 * The words and the pin for each class live in markerIcons.ts (COVERAGE_MARK).
 */
export type CoverageClass = "sampled" | "repeat" | "never_visited";

export function coverageFromVisitCount(visitCount: number): CoverageClass {
  if (visitCount > 1) return "repeat";
  if (visitCount === 1) return "sampled";
  return "never_visited";
}

export function parseCoverageClass(raw: string | null | undefined): CoverageClass {
  switch ((raw ?? "").toLowerCase()) {
    case "sampled":
      return "sampled";
    case "repeat":
      return "repeat";
    case "never_visited":
      return "never_visited";
    default:
      return "never_visited";
  }
}
