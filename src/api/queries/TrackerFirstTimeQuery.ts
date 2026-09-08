import { graphql } from "react-relay";

/**
 * Master Tracker FIRST-TIME strip — skinny tenantKpis firstTimeConsumers only.
 * Matches the same custom-field rollup Insights uses ("first time" labels,
 * including Torch's "First Time consumers?").
 */
export const TrackerFirstTimeQuery = graphql`
  query TrackerFirstTimeQuery($tenantId: ID!, $year: Int) {
    tenantKpis(tenantId: $tenantId, year: $year) {
      firstTimeConsumers
    }
  }
`;
