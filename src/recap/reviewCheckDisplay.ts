/**
 * Plain rule-based review checks (roadmap #3) — presentation helpers.
 *
 * The rules themselves run on the server (`recapReviewChecks` GraphQL);
 * this module only decides what ops sees: `na` checks are hidden, flags
 * sort ahead of passes, and each status gets a fixed tint. Advisory only
 * — there is no score here and nothing auto-approves or rejects.
 */

export type ReviewCheckStatus = "pass" | "flag" | "na";

export type ReviewCheck = {
  code: string;
  label: string;
  status: string;
  detail?: string | null;
};

export type VisibleReviewCheck = {
  code: string;
  label: string;
  detail: string;
  flagged: boolean;
};

/** Checks ops should see: applicable ones only, flags first (stable). */
export function visibleReviewChecks(
  checks: readonly ReviewCheck[] | null | undefined,
): VisibleReviewCheck[] {
  const visible = (checks ?? []).filter(
    (c) => c.status === "pass" || c.status === "flag",
  );
  return visible
    .map((c, i) => ({
      code: c.code,
      label: c.label,
      detail: c.detail ?? "",
      flagged: c.status === "flag",
      order: i,
    }))
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.order - b.order)
    .map(({ code, label, detail, flagged }) => ({ code, label, detail, flagged }));
}

export function reviewCheckCounts(
  checks: readonly ReviewCheck[] | null | undefined,
): { flagged: number; passed: number } {
  const visible = visibleReviewChecks(checks);
  return {
    flagged: visible.filter((c) => c.flagged).length,
    passed: visible.filter((c) => !c.flagged).length,
  };
}

/** Exhaustive status → chip tint. Dark ops chrome: lime pass, orange flag. */
export function reviewCheckTint(status: ReviewCheckStatus): {
  color: string;
  background: string;
  border: string;
  mark: string;
} {
  switch (status) {
    case "flag":
      return {
        color: "#ffb59d",
        background: "rgba(239,90,42,0.14)",
        border: "rgba(239,90,42,0.5)",
        mark: "⚠",
      };
    case "pass":
      return {
        color: "#c5f546",
        background: "rgba(197,245,70,0.10)",
        border: "rgba(197,245,70,0.35)",
        mark: "✓",
      };
    case "na":
      return {
        color: "rgba(255,255,255,0.55)",
        background: "rgba(255,255,255,0.04)",
        border: "var(--spark-border)",
        mark: "–",
      };
    default: {
      const _never: never = status;
      throw new Error(`Unknown review check status: ${String(_never)}`);
    }
  }
}
