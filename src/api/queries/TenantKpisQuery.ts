import { graphql } from "react-relay";

/**
 * Aggregated KPI rollup for a single client (tenant) — every event, recap and
 * consumer signal we have for that tenant, summed into headline totals plus a
 * 12-month trend.
 *
 * Powers the <TenantKpiCharts> panel mounted on both dashboards (the admin
 * home dashboard and the client dashboard), scoped to the active tenant from
 * `useAuthStore().tenantId`. Unlike the on-demand Ask-AI queries this is a
 * plain read — components load it the usual way (useLazyLoadQuery /
 * fetchQuery) so it can paint on mount.
 *
 * `monthlyTrend` is an ordered list of up to 12 months (oldest → newest); each
 * entry carries that month's recaps, engagements and samples for the trend
 * chart. When the tenant has no activity yet the totals are all zero and
 * `monthlyTrend` may be empty — the panel renders an empty state in that case.
 */
export const TenantKpisQuery = graphql`
  query TenantKpisQuery($tenantId: ID!) {
    tenantKpis(tenantId: $tenantId) {
      events
      recaps
      consumersReached
      samplesDistributed
      productsSold
      cansSold
      packsSold
      totalEngagements
      firstTimeConsumers
      brandAwareConsumers
      willingToPurchase
      monthlyTrend {
        month
        recaps
        engagements
        samples
      }
    }
  }
`;
