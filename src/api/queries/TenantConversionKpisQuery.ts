import { graphql } from "react-relay";

/** Retail + On-Premise conversion for Insights page range (+ prior twin). */
export const TenantConversionKpisQuery = graphql`
  query TenantConversionKpisQuery(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    tenantConversionKpis(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      sold
      engagements
      pct
      previousSold
      previousEngagements
      previousPct
      currentLabel
      previousLabel
    }
  }
`;
