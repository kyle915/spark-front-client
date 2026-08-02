import { graphql } from "react-relay";

/**
 * Today's shifts with each assigned BA's live clock status, for the admin
 * "on the clock" board. `date` is optional (defaults to today, server-side).
 */
export const LiveShiftBoardQuery = graphql`
  query LiveShiftBoardQuery($date: String, $tenantId: ID) {
    liveShiftBoard(date: $date, tenantId: $tenantId) {
      eventUuid
      eventName
      brandName
      date
      startTime
      endTime
      address
      store
      requestUuid
      onClock
      noShows
      pendingApproval
      assigned {
        ambassadorUuid
        name
        status
        clockInAt
        clockOutAt
        workedHours
        lat
        lng
        locationAt
        locationSource
        pendingApproval
      }
    }
  }
`;
