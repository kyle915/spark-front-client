import { graphql } from "react-relay";

/**
 * Live executive summary — same aggregator the weekly Monday email
 * uses, exposed as a query so the dashboard can render the same
 * numbers without waiting for cron. Drives the "Pace" widget on
 * /dashboard.
 *
 * Window is 7 days by default; the front-end can pass `windowDays`
 * to widen or narrow. Returns null when no tenant is in scope.
 */
export const ExecutiveSummaryQuery = graphql`
  query ExecutiveSummaryQuery($tenantId: ID, $windowDays: Int!) {
    executiveSummary(tenantId: $tenantId, windowDays: $windowDays) {
      tenantName
      periodLabel
      recapCount
      consumerReach
      samplesDistributed
      topStores {
        label
        primaryMetric
        secondaryMetric
      }
      topBas {
        label
        primaryMetric
      }
      recapCountDeltaChip
      consumerReachDeltaChip
    }
  }
`;
