import { graphql } from "react-relay";

/**
 * The latest weekly summary for one brand's dashboard, or null.
 *
 * A brand user only ever gets a summary staff have marked reviewed.
 * Ignite staff also get the latest unreviewed draft, with `isDraft` true.
 * Reads a stored row; it never asks the model.
 */
export const TenantWeeklySummaryQuery = graphql`
  query TenantWeeklySummaryQuery($tenantId: ID!) {
    tenantWeeklySummary(tenantId: $tenantId) {
      weekStart
      weekEnd
      text
      isDraft
      reviewedAt
    }
  }
`;
