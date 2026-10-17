/**
 * Store-coverage classification for the Account Map.
 *
 * Definition (server-computed in events.admin_payloads, mirrored here for
 * display): a roster retailer is Sampled with exactly 1 distinct event
 * that has a filed recap, Repeat with >1, and Never visited with 0.
 * Requests/events alone never make a store Sampled — they are Planned.
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

export function coverageLabel(cls: CoverageClass): string {
  switch (cls) {
    case "sampled":
      return "Sampled";
    case "repeat":
      return "Repeat";
    case "never_visited":
      return "Never visited";
    default: {
      const _exhaustive: never = cls;
      return _exhaustive;
    }
  }
}

export function coverageColor(cls: CoverageClass): string {
  switch (cls) {
    case "sampled":
      return "#c5f546";
    case "repeat":
      return "#5fb8ef";
    case "never_visited":
      return "#ef5a2a";
    default: {
      const _exhaustive: never = cls;
      return _exhaustive;
    }
  }
}
