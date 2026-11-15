import { graphql } from "react-relay";

/**
 * Each brand's written summary for one week (Monday to Sunday by event
 * date), for Ignite staff. Null for anyone else. Reads stored drafts; it
 * never asks the model. `pendingRecaps` are filed that week and still
 * waiting for review, so they are not in the draft.
 */
export const WeeklyClientSummariesQuery = graphql`
  query WeeklyClientSummariesQuery($weekStart: String) {
    weeklyClientSummaries(weekStart: $weekStart) {
      weekStart
      weekEnd
      rows {
        tenantId
        tenantName
        approvedRecaps
        pendingRecaps
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
  }
`;
