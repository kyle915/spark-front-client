import { graphql } from "react-relay";

/** Every numeric recap answer for a brand, totalled field by field. */
export const TenantRecapFieldTotalsQuery = graphql`
  query TenantRecapFieldTotalsQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantRecapFieldTotals(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      section
      fields {
        label
        kind
        total
        average
        recaps
        isPercent
      }
    }
  }
`;

export default TenantRecapFieldTotalsQuery;
