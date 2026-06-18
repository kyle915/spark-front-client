import { graphql } from "react-relay";

/**
 * Per-gig GPS mileage rollup for the admin Event / Request view: the gig's
 * current tracking config (so the panel can render its enable toggle + rate)
 * plus every BA's logged trip and the total miles + reimbursement. Backs
 * EventMileagePanel beside the attendance table.
 */
export const EventMileageSummaryQuery = graphql`
  query EventMileageSummaryQuery($eventId: ID!) {
    eventMileageSummary(eventId: $eventId) {
      eventUuid
      trackMileage
      mileageRate
      totalMiles
      totalReimbursement
      sessionCount
      sessions {
        uuid
        status
        ambassadorName
        totalMiles
        reimbursementAmount
      }
    }
  }
`;
