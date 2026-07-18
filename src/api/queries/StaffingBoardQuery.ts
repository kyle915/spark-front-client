import { graphql } from "react-relay";

/**
 * Week-grid of shifts × their assigned BAs for the Staffing Board.
 * Date range is inclusive (by event date), tenant-scoped server-side.
 */
export const StaffingBoardQuery = graphql`
  query StaffingBoardQuery($startDate: String!, $endDate: String!, $tenantId: ID) {
    staffingBoard(startDate: $startDate, endDate: $endDate, tenantId: $tenantId) {
      eventUuid
      eventId
      eventName
      brandName
      date
      startTime
      endTime
      address
      store
      requestUuid
      isStaffed
      assigned {
        ambassadorUuid
        ambassadorId
        name
        isApproved
      }
    }
  }
`;
