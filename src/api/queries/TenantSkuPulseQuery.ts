import { graphql } from "react-relay";

/** Top catalog SKUs by samples handed out (approved recaps only). */
export const TenantSkuPulseQuery = graphql`
  query TenantSkuPulseQuery(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    tenantSkuPulse(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      mode
      totalSamples
      items {
        product
        samples
      }
    }
  }
`;
