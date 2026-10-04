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
 * entry carries that month's recaps plus every bar metric. `trendSeries` says
 * which bars this tenant charts (Engagements + Samples, or Consumers sampled +
 * Units sold for retail-sales programs like Torch) and `trendNote` explains
 * the basis. When the tenant has no activity yet the totals are all zero and
 * `monthlyTrend` may be empty — the panel renders an empty state in that case.
 *
 * The optional `year` narrows the rollup to a single calendar year (Jan→current
 * month for the current year, Jan→Dec for a past year). Pass null for the
 * all-time / trailing-12-month view. The <TenantKpiCharts> year dropdown drives
 * this; default is the current calendar year.
 */
export const TenantKpisQuery = graphql`
  query TenantKpisQuery($tenantId: ID!, $year: Int) {
    tenantKpis(tenantId: $tenantId, year: $year) {
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
        consumersSampled
        unitsSold
      }
      trendSeries {
        key
        label
      }
      trendNote
    }
  }
`;
