import { graphql } from "react-relay";

/**
 * Batched flagged review-check summaries for the Needs-review list.
 * One round-trip per kind (legacy / custom); only `flag` checks come
 * back. Advisory badges only — never auto-approves.
 */
export const RecapReviewFlagsQuery = graphql`
  query RecapReviewFlagsQuery($recapIds: [ID!]!, $isCustom: Boolean!) {
    recapReviewFlags(recapIds: $recapIds, isCustom: $isCustom) {
      recapId
      flags {
        code
        label
      }
    }
  }
`;
