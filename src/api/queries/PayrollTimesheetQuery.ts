import { graphql } from "react-relay";

/**
 * Per-BA worked hours + estimated pay over a pay period, for the payroll
 * timesheet page + CSV export. Dates are YYYY-MM-DD (inclusive, by event date).
 */
export const PayrollTimesheetQuery = graphql`
  query PayrollTimesheetQuery($startDate: String!, $endDate: String!, $tenantId: ID) {
    payrollTimesheet(startDate: $startDate, endDate: $endDate, tenantId: $tenantId) {
      startDate
      endDate
      totalHours
      totalEstimatedPay
      flaggedRows
      rows {
        ambassadorUuid
        name
        email
        shifts
        hours
        estimatedShifts
        estimatedPay
        shiftsMissingRate
        flags
        needsReview
      }
    }
  }
`;
