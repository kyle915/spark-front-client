import { graphql } from "react-relay";

/**
 * Per-state activity rollup for a single client (tenant) — the data behind the
 * Geographic Performance heatmap. The backend returns one `MarketPerformance`
 * row per US state that has any placed activity (states with none are simply
 * absent from the list), keyed by the 2-letter US state code (`state`, e.g.
 * "CA"). Each row carries that state's totals: events, recaps, consumers
 * reached, samples distributed, products sold, and total engagements.
 *
 * Loaded all-time here (the `year` argument is omitted, which the backend
 * treats as null = all-time) to match the way the <TenantGeoHeatmap> surfaces
 * the whole program's geographic footprint at a glance.
 *
 * Powers the <TenantGeoHeatmap> mounted on both dashboards (the admin home
 * dashboard and the client dashboard), scoped to the active tenant from
 * `useAuthStore().tenantId`. Like the KPI / Insights rollups this is a plain
 * read — components load it the usual way (useLazyLoadQuery / store-or-network)
 * so it paints on mount rather than firing on a click. When the tenant has no
 * placed activity yet the list is empty and the panel renders a quiet empty
 * state instead of a blank map.
 */
export const TenantMarketPerformanceQuery = graphql`
  query TenantMarketPerformanceQuery($tenantId: ID!) {
    tenantMarketPerformance(tenantId: $tenantId) {
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
