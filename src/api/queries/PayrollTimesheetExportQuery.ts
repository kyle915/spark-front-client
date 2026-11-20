import { graphql } from "react-relay";

/**
 * Every confirmed shift in a pay period, one row per worker per shift, with
 * who worked it — the time-sheet CSV (name, phone, date, location, clock in,
 * clock out, hours). Staff only on the server.
 */
export const PayrollTimesheetExportQuery = graphql`
  query PayrollTimesheetExportQuery($startDate: String!, $endDate: String!, $tenantId: ID) {
    payrollTimesheetExport(startDate: $startDate, endDate: $endDate, tenantId: $tenantId) {
      ambassadorUuid
      ambassadorName
      ambassadorPhone
      date
      tenantName
      address
      clockInAt
      clockOutAt
      timeZone
      onTheClock
      hours
      estimated
    }
  }
`;
