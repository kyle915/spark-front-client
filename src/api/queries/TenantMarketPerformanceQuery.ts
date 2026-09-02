import { graphql } from "react-relay";

/**
 * Per-state activity rollup for a single client (tenant) — the data behind the
 * Geographic Performance heatmap. Optional `startDate` / `endDate` scope to
 * the Insights page range; omit both (and year) for all-time.
 */
export const TenantMarketPerformanceQuery = graphql`
  query TenantMarketPerformanceQuery(
    $tenantId: ID!
    $year: Int
    $startDate: String
    $endDate: String
  ) {
    tenantMarketPerformance(
      tenantId: $tenantId
      year: $year
      startDate: $startDate
      endDate: $endDate
    ) {
      state
      eventCount
      recapCount
      consumersReached
      samplesDistributed
      productsSold
      totalEngagements
    }
  }
`;
