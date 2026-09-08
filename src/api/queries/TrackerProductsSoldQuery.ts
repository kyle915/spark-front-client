import { graphql } from "react-relay";

/**
 * Master Tracker PRODUCTS PURCHASED strip — skinny tenantKpis productsSold.
 * Same two-tier sold matcher as Insights / recap list soldUnits (cans/packs
 * primary; sold/bought/purchased fallback). Torch retail fields:
 * "How many single cans did consumers purchase?" +
 * "How many packs did consumers purchase?".
 */
export const TrackerProductsSoldQuery = graphql`
  query TrackerProductsSoldQuery($tenantId: ID!, $year: Int) {
    tenantKpis(tenantId: $tenantId, year: $year) {
      productsSold
    }
  }
`;
