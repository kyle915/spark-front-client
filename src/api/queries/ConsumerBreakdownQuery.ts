import { graphql } from "react-relay";

/**
 * Consumers sampled for one client over a date range, split by week, by
 * store and by state.
 *
 * All three splits come from one pass on the server, so each adds up to
 * `total`: the weekly trend, the store ranking and the state ranking can
 * sit under one headline and agree with it. Counted on the same basis as
 * `tenantKpis.consumersReached`: approved recaps, dated by the event (not
 * by when the recap was filed), leaving out deleted requests, events kept
 * off the dashboard and agency filings.
 *
 * `byStore` is the largest stores, then one `kind: "other"` row for the
 * rest, then one `kind: "missing"` row for recaps whose event has no store
 * recorded. `byState` has the same `missing` row for events with no state.
 * `storeCount` / `stateCount` are how many named ones exist in all.
 *
 * Resolves to null when the client is out of scope or the rollup fails, so
 * a chart shows nothing rather than a partial number.
 */
export const ConsumerBreakdownQuery = graphql`
  query ConsumerBreakdownQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantConsumerBreakdown(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      total
      recaps
      storeCount
      stateCount
      byWeek {
        weekStart
        consumers
        recaps
      }
      byStore {
        label
        kind
        consumers
        recaps
      }
      byState {
        label
        kind
        consumers
        recaps
      }
    }
  }
`;
