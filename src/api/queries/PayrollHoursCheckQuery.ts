import { graphql } from "react-relay";

/**
 * Hours check before payroll — rule-based flags on padded or impossible
 * shifts for one client's pay period (same shifts the timesheet pays).
 * Staff only. `explain` asks for an optional one-line plain-English reason
 * per flag; the rules decide everything either way.
 */
export const PayrollHoursCheckQuery = graphql`
  query PayrollHoursCheckQuery(
    $startDate: String!
    $endDate: String!
    $tenantId: ID!
    $explain: Boolean!
  ) {
    payrollHoursCheck(
      startDate: $startDate
      endDate: $endDate
      tenantId: $tenantId
      explain: $explain
    ) {
      totalShifts
      flaggedShifts
      needsLookShifts
      byRule {
        code
        title
        severity
        count
        unreviewed
      }
      shifts {
        eventUuid
        eventName
        ambassadorUuid
        ambassadorName
        date
        needsLook
        flags {
          code
          title
          severity
          summary
          action
          aiReason
          usesLocation
          reviewed
          staleReview
          reviewedBy
          reviewedAt
          reviewNote
          facts {
            label
            value
          }
        }
      }
    }
  }
`;
