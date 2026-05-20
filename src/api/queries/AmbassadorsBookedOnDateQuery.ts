import { graphql } from "react-relay";

/**
 * Returns the relay-encoded ambassador IDs already booked on a given
 * date (any AmbassadorEvent.event.date == onDate). Powers the
 * "⚠ Already on another shift that day" red chip in the InviteBAModal
 * so admins can avoid double-booking a BA.
 *
 * Includes BOTH approved (already accepted) and pending (invited but
 * not yet responded) shifts so the chip catches in-flight conflicts
 * too.
 */
export const AmbassadorsBookedOnDateQuery = graphql`
  query AmbassadorsBookedOnDateQuery($onDate: String!, $tenantId: ID) {
    ambassadorsBookedOnDate(onDate: $onDate, tenantId: $tenantId)
  }
`;
