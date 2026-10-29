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

/** Exhaustive status → chip tint. Dark ops chrome: off-white pass, orange flag. */
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
        color: "#f2f3ee",
        background: "rgba(242,243,238,0.08)",
        border: "rgba(242,243,238,0.28)",
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

/**
 * Short Needs-review list badge labels. Detail keeps the full check label;
 * the list only needs a glanceable code (GPS / Photos / Hours / …).
 */
const REVIEW_FLAG_BADGE_LABEL: Record<string, string> = {
  engagements_rate: "Hours",
  gps_distance: "GPS",
  photo_buckets: "Photos",
  duplicate_photos: "Dupes",
  spend_without_receipt: "Receipt",
};

export type ReviewFlagBadge = {
  code: string;
  /** Short chip text for the list row. */
  badge: string;
  /** Full server label — used as the chip title/tooltip. */
  label: string;
};

/** Map batched flagged summaries onto short list badges (stable code order). */
export function reviewFlagBadges(
  flags: readonly { code: string; label: string }[] | null | undefined,
): ReviewFlagBadge[] {
  const order = Object.keys(REVIEW_FLAG_BADGE_LABEL);
  const byCode = new Map<string, string>();
  for (const flag of flags ?? []) {
    if (!flag?.code) continue;
    byCode.set(flag.code, flag.label || flag.code);
  }
  const badges: ReviewFlagBadge[] = [];
  for (const code of order) {
    const label = byCode.get(code);
    if (!label) continue;
    badges.push({
      code,
      badge: REVIEW_FLAG_BADGE_LABEL[code] ?? code,
      label,
    });
    byCode.delete(code);
  }
  for (const [code, label] of byCode) {
    badges.push({ code, badge: code, label });
  }
  return badges;
}

/** Short list-badge copy for a flagged check code (GPS / Photos / …). */
export function reviewFlagShortLabel(code: string): string {
  return REVIEW_FLAG_BADGE_LABEL[code] ?? "Flag";
}

export type ReviewFlagSummary = {
  code: string;
  label: string;
};

