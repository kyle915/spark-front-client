import { graphql } from "react-relay";

/**
 * Events that wrapped (end_time < now) but don't have a recap row
 * attached. Drives `/recaps/missing` — the admin's daily "what does
 * my team still owe me" list.
 *
 * Returns the assigned ambassadors inline so the row can offer
 * per-BA "Nudge" / "File for them" actions without an N+1 round-trip.
 */
export const MissingRecapEventsQuery = graphql`
  query MissingRecapEventsQuery($tenantId: ID, $lookbackDays: Int!) {
    missingRecapEvents(tenantId: $tenantId, lookbackDays: $lookbackDays) {
      eventUuid
      eventName
      venue
      address
      stateCode
      date
      startTime
      endTime
      hoursOverdue
      requestUuid
      suggestedWalkupAttach {
        orphanEventUuid
        orphanEventName
        orphanAddress
        requestUuid
        confidence
      }
      assignedAmbassadors {
        ambassadorEventUuid
        ambassadorUuid
        name
        email
        isApproved
        lastNudgedAt
        lastNudgeChannel
      }
    }
  }
`;
