import { graphql } from "react-relay";

/**
 * Server-aggregated request counts by calendar day, request type, and top
 * retailers so dashboards and report charts do not walk thousands of
 * connection edges on the browser.
 */
export const TenantRequestsRollupQuery = graphql`
  query TenantRequestsRollupQuery(
    $tenantId: ID
    $startDate: Date
    $endDate: Date
    $dateField: String!
  ) {
    tenantRequestsRollup(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      dateField: $dateField
    ) {
      totalCount
      byDay {
        date
        count
      }
      byRequestType {
        name
        count
      }
      topRetailers {
        name
        count
      }
    }
  }
`;
