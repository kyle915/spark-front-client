import { graphql } from "react-relay";

/**
 * Period-over-period KPI comparison for a single client (tenant) — the same
 * headline totals the KPI rollup tracks, but split into the most recent
 * COMPLETE period (`current`) and the one before it (`previous`) so the
 * dashboard can show this-period vs last-period with up/down deltas.
 *
 * Powers the <TenantKpiComparison> card mounted near <TenantKpiCharts> on both
 * dashboards (the admin home dashboard and the client dashboard) and the admin
 * client-detail page, scoped to the active tenant from `useAuthStore().tenantId`
 * (the route `:tenantId` on the detail page). Like the KPI / Insights rollups
 * this is a plain read — components load it the usual way (useLazyLoadQuery /
 * store-or-network) so it paints on mount rather than firing on a click.
 *
 * `period` is one of "month" | "quarter" | "year"; the card's period toggle
 * drives it (default "month"), so switching the toggle refetches the rollup.
 * The backend always anchors `current` to the most recent COMPLETE period and
 * fills `currentLabel` / `previousLabel` with human strings ("May 2026" /
 * "Apr 2026"). `tenantKpiComparison` resolves to null when there's no data —
 * the card renders nothing in that case (no empty frame).
 */
export const TenantKpiComparisonQuery = graphql`
  query TenantKpiComparisonQuery($tenantId: ID!, $period: String!) {
    tenantKpiComparison(tenantId: $tenantId, period: $period) {
      period
      currentLabel
      previousLabel
      sparseNote
      current {
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
        program {
          recaps
          demos
          consumersSampled
          unitsSold
          cansSold
          packsSold
          conversionPct
          dryDemos
          dryPeopleEngaged
          firstTimeConsumers
          firstTimeBase
          brandAwareConsumers
          willingToPurchase
        }
      }
      previous {
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
        program {
          recaps
          demos
          consumersSampled
          unitsSold
          cansSold
          packsSold
          conversionPct
          dryDemos
          dryPeopleEngaged
          firstTimeConsumers
          firstTimeBase
          brandAwareConsumers
          willingToPurchase
        }
      }
    }
  }
`;
