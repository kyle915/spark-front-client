import { graphql } from "react-relay";

/**
 * Master Tracker CONSUMERS strip — skinny tenantKpis sampling totals.
 * Same source as Insights Program KPIs (not eventDashboard), so Tracker and
 * Insights stay aligned. UI collapses consumers/samples/engagements twins.
 */
export const TrackerConsumersQuery = graphql`
  query TrackerConsumersQuery($tenantId: ID!, $year: Int) {
    tenantKpis(tenantId: $tenantId, year: $year) {
      consumersReached
      samplesDistributed
      totalEngagements
    }
  }
`;
