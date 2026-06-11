import { graphql } from "react-relay";

/**
 * Per-BA clock log for an event — arrive / clock-in / clock-out times
 * (+ coords) and on-site hours. Backs the Attendance table beside the
 * Shift Replay GPS map on /request/view and the Event detail page.
 */
export const EventAttendanceQuery = graphql`
  query EventAttendanceQuery($eventUuid: ID!) {
    eventAttendance(eventUuid: $eventUuid) {
      ambassadorUuid
      ambassadorName
      arrivedAt
      clockInAt
      clockOutAt
      clockInCoordinates
      clockOutCoordinates
      hoursOnSite
    }
  }
`;
