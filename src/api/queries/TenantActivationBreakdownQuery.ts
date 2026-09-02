import { graphql } from "react-relay";

/**
 * Server-side activation-type counts for Insights.
 *
 * Replaces the old client rollup of the first 2000 Requests + regex on
 * requestType names. Optional ISO date bounds scope `Request.date`.
 */
export const TenantActivationBreakdownQuery = graphql`
  query TenantActivationBreakdownQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantActivationBreakdown(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      startDate
      endDate
      buckets {
        key
        label
        count
      }
    }
  }
`;
