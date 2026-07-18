import { graphql } from "react-relay";

/**
 * Per-campaign (brand) cost roll-up over a date range: labor (clock hours ×
 * booked rate) + expense-receipt spend. Margin is computed on the page from an
 * optional revenue the admin enters (Spark doesn't hold the client sell-price).
 */
export const CampaignCostQuery = graphql`
  query CampaignCostQuery($startDate: String!, $endDate: String!, $tenantId: ID) {
    campaignCost(startDate: $startDate, endDate: $endDate, tenantId: $tenantId) {
      startDate
      endDate
      totalLabor
      totalSpend
      totalCost
      rows {
        tenantId
        tenantName
        events
        shifts
        hours
        laborCost
        spend
        totalCost
        eventsMissingRates
      }
    }
  }
`;
