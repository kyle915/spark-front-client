import { graphql } from "react-relay";

/**
 * Plain rule-based review checks for one recap (roadmap #3), shown beside
 * Approve. Server-computed fixed rules only — no score, no AI. Each check
 * is `pass` / `flag` / `na` (not applicable; the UI hides `na`). Advisory
 * only: flags never block or trigger approval. Never-raises on the
 * backend (missing / out-of-scope recaps return all-`na`).
 */
export const RecapReviewChecksQuery = graphql`
  query RecapReviewChecksQuery($recapId: ID!, $isCustom: Boolean!) {
    recapReviewChecks(recapId: $recapId, isCustom: $isCustom) {
      code
      label
      status
      detail
    }
  }
`;
