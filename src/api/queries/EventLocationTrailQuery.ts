import { graphql } from "react-relay";

/**
 * All GPS pings for an event, oldest first. Returns up to 1000 rows.
 * Used by the Shift Replay panel on the Request View to draw the
 * BA's path during the activation as a polyline.
 */
export const EventLocationTrailQuery = graphql`
  query EventLocationTrailQuery($eventUuid: ID!) {
    eventLocationTrail(eventUuid: $eventUuid) {
      uuid
      lat
      lng
      recordedAt
      source
      ambassadorName
    }
  }
`;
