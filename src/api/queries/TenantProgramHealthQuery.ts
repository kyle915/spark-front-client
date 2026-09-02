import { graphql } from "react-relay";

/**
 * Scheduled → filed → approved funnel for Insights program-health.
 *
 * Filed uses the shared content-submitted definition (empty clock-out
 * shells do not count). Optional ISO date bounds scope Request.date.
 */
export const TenantProgramHealthQuery = graphql`
  query TenantProgramHealthQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantProgramHealth(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      scheduled
      filed
      approved
      missing
      startDate
      endDate
    }
  }
`;
