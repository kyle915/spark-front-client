import { graphql } from "react-relay";

/**
 * Scalar recap aggregates for Metric Trends + Product Analysis tabs.
 * No LLM cost — deterministic tenant KPIs + SKU breakdown.
 */
export const InsightsAggregatesQuery = graphql`
  query InsightsAggregatesQuery(
    $tenantId: ID!
    $year: Int
    $startDate: String!
    $endDate: String!
  ) {
    tenantKpis(tenantId: $tenantId, year: $year) {
      recaps
      consumersReached
      samplesDistributed
      productsSold
      totalEngagements
      monthlyTrend {
        month
        recaps
        engagements
        samples
      }
    }
    tenantFieldSamplingReport(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      ytdSkuBreakdown {
        items {
          product
          total
        }
      }
      weekSkuBreakdown {
        items {
          product
          total
        }
      }
    }
  }
`;
