import { graphql } from "react-relay";

/**
 * Server-computed "quality check" for a single recap — a review aid for the
 * approver, surfaced in the recap detail view.
 *
 * The backend inspects the recap and returns a `score` (0–100, where 100 means
 * it looks complete / clean) plus the `flags` it found — the specific issues
 * worth a second look (e.g. `no_photos`, `no_feedback`, `sold_exceeds_sampled`,
 * `low_feedback_quality`). Each flag carries a stable `code`, a human-readable
 * `label` to render, and a `severity` ∈ "high" | "medium" | "low". An empty
 * `flags` list together with a score of 100 means nothing was flagged.
 *
 * `recapId` is the recap's global id (the same id the detail view already holds);
 * `isCustom` selects which recap family to inspect — `true` for a custom recap
 * (<RecapCustomView>), `false` for a legacy recap (<SparkRecapView>). The field
 * is never-raises on the backend and defaults to score 100 / no flags, so the
 * panel can degrade quietly.
 */
export const RecapQualityFlagsQuery = graphql`
  query RecapQualityFlagsQuery($recapId: ID!, $isCustom: Boolean!) {
    recapQualityFlags(recapId: $recapId, isCustom: $isCustom) {
      score
      flags {
        code
        label
        severity
      }
    }
  }
`;
