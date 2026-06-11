import { graphql } from "react-relay";

/**
 * Per-event cost rows: labor = clock-pair hours × booked rate (with a
 * scheduled-duration fallback flagged `estimated`), spend = expense
 * receipts. `missingRates` > 0 means the labor figure is incomplete —
 * the page shows the gap instead of a silently-wrong number.
 */
export const EventPnlQuery = graphql`
  query EventPnlQuery($tenantId: ID!, $startDate: String!, $endDate: String!) {
    eventPnl(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      eventId
      uuid
      name
      date
      baCount
      hours
      laborCost
      spend
      totalCost
      estimated
      missingRates
    }
  }
`;
