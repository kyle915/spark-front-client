import { graphql } from "react-relay";

/**
 * Write (or write again) one brand's summary for a week. Replaces a stored
 * draft and its edit. Sends nothing to anyone.
 */
export const GenerateWeeklyClientSummaryMutation = graphql`
  mutation WeeklyClientSummaryMutationsGenerateMutation(
    $tenantId: ID!
    $weekStart: String!
  ) {
    generateWeeklyClientSummary(tenantId: $tenantId, weekStart: $weekStart) {
      ok
      reason
      summary {
        id
        weekStart
        weekEnd
        body
        editedBody
        text
        status
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;

/** Keep staff's wording. The generated draft itself is left as written. */
export const SaveWeeklyClientSummaryMutation = graphql`
  mutation WeeklyClientSummaryMutationsSaveMutation(
    $id: ID!
    $editedBody: String!
  ) {
    saveWeeklyClientSummary(id: $id, editedBody: $editedBody) {
      ok
      reason
      summary {
        id
        weekStart
        weekEnd
        body
        editedBody
        text
        status
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;

/** Mark a summary reviewed, or put it back to draft. Sends nothing. */
export const SetWeeklyClientSummaryReviewedMutation = graphql`
  mutation WeeklyClientSummaryMutationsReviewedMutation(
    $id: ID!
    $reviewed: Boolean!
  ) {
    setWeeklyClientSummaryReviewed(id: $id, reviewed: $reviewed) {
      ok
      reason
      summary {
        id
        weekStart
        weekEnd
        body
        editedBody
        text
        status
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;
