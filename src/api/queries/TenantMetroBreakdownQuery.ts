import { graphql } from "react-relay";

/**
 * Week-by-metro-market KPI breakdown for tenants whose events follow the
 * "<Market> — <Corridor> · <date>" naming convention — built for Feel
 * Free's Guerrilla Field Sampling program, which runs identical weekly
 * shifts across several metro markets (Miami, Ft. Lauderdale, Tampa/St.
 * Pete, Austin, San Antonio) with no structured city/market field to group
 * by. See `recaps/tenant_overview.py::tenant_metro_breakdown` on the
 * backend.
 *
 * `startDate`/`endDate` are caller-chosen ISO dates (the frontend renders a
 * date-range control); `eventTypeId` optionally restricts to one EventType
 * (Feel Free's "Field Sampling"). Deliberately named "metro" throughout —
 * "market" already means US state (`tenantMarketPerformance`) and retailer
 * (`RecapDashboard.marketAnalysis`) elsewhere in this schema.
 *
 * `metros` is empty for tenants whose events don't follow the naming
 * convention — the frontend uses that to hide the whole section rather
 * than showing an empty table for every other client.
 */
export const TenantMetroBreakdownQuery = graphql`
  query TenantMetroBreakdownQuery(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
    $eventTypeId: ID
  ) {
    tenantMetroBreakdown(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      eventTypeId: $eventTypeId
    ) {
      metros
      weeks {
        isoYear
        isoWeek
        weekStart
        cells {
          metro
          eventCount
          recapCount
          consumersReached
          samplesDistributed
          productsSold
          totalEngagements
        }
      }
    }
  }
`;
