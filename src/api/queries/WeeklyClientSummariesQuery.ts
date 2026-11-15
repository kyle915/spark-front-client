import { graphql } from "react-relay";

/**
 * Each brand's written summary for one week (Monday to Sunday by event
 * date) or, with period "month", its client email draft for one calendar
 * month (weekStart / weekEnd are then its first and last day), for Ignite
 * staff. Null for anyone else. Reads stored drafts; it
 * never asks the model. `pendingRecaps` are filed that week and still
 * waiting for review, so they are not in the draft.
 */
export const WeeklyClientSummariesQuery = graphql`
  query WeeklyClientSummariesQuery($weekStart: String, $period: String!) {
    weeklyClientSummaries(weekStart: $weekStart, period: $period) {
      period
      weekStart
      weekEnd
      rows {
        tenantId
        tenantName
        approvedRecaps
        pendingRecaps
        summary {
          id
          period
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
