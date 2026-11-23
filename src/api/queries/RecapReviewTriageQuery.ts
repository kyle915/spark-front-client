import { graphql } from "react-relay";

/**
 * Batched Clean / Needs Eyes labels for the admin Needs-review list.
 * Staff-only on the server (IsSparkAdminAccess). Advisory — never
 * auto-approves. Clients must not call this.
 */
export const RecapReviewTriageQuery = graphql`
  query RecapReviewTriageQuery($recapIds: [ID!]!, $isCustom: Boolean!) {
    recapReviewTriage(recapIds: $recapIds, isCustom: $isCustom) {
      recapId
      label
      reasons {
        code
        label
        source
      }
    }
  }
`;
