import { graphql } from "react-relay";

/**
 * The shifts behind one ambassador's timesheet row (same period + tenant
 * scope as PayrollTimesheetQuery, un-aggregated). Carries the attendance
 * uuids the admin punch editor needs.
 */
export const PayrollTimesheetShiftsQuery = graphql`
  query PayrollTimesheetShiftsQuery(
    $startDate: String!
    $endDate: String!
    $ambassadorUuid: String!
    $tenantId: ID
  ) {
    payrollTimesheetShifts(
      startDate: $startDate
      endDate: $endDate
      ambassadorUuid: $ambassadorUuid
      tenantId: $tenantId
    ) {
      eventUuid
      eventName
      date
      tenantName
      address
      clockInAt
      clockOutAt
      clockInAttendanceUuid
      clockOutAttendanceUuid
      onTheClock
      scheduledHours
      hours
      estimated
      rate
      pay
    }
  }
`;
