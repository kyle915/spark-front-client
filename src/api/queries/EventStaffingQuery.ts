import { graphql } from "react-relay";

/**
 * Smart-staffing snapshot for a single Event.
 *
 * Returns the live fill status (assigned / confirmed / needed) plus a
 * server-ranked list of suggested BAs (nearest + best-rated +
 * available first) for the admin Smart-staffing panel on the
 * Request/Event view. The backend does the ranking so the panel just
 * renders the order it gets back.
 *
 * `limit` caps how many suggestions come back (the panel passes a
 * sensible default). Each suggestion carries `alreadyInvited` /
 * `alreadyAssigned` so the panel can disable + label rows that are
 * already on the shift.
 */
export const EventStaffingQuery = graphql`
  query EventStaffingQuery($eventId: ID!, $limit: Int) {
    eventStaffing(eventId: $eventId, limit: $limit) {
      eventId
      assigned
      confirmed
      needed
      fillRate
      suggestions {
        id
        uuid
        name
        rating
        distanceMiles
        isAvailable
        alreadyInvited
        alreadyAssigned
        email
        phone
      }
    }
  }
`;
