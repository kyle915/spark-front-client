import { graphql } from "react-relay";

/** Scheduled next 7d vs approved recaps last 7d. */
export const TenantFieldCadenceQuery = graphql`
  query TenantFieldCadenceQuery($tenantId: ID!) {
    tenantFieldCadence(tenantId: $tenantId) {
      scheduledNext7
      approvedRecapsLast7
      scheduleStart
      scheduleEnd
      approvedStart
      approvedEnd
    }
  }
`;
