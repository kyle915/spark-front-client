import { graphql } from "react-relay";

/** Whether the viewer may open this brand's "Compare brands" tab. */
export const BrandCompareGateQuery = graphql`
  query BrandCompareGateQuery($tenantId: ID!) {
    canCompareBrands(tenantId: $tenantId)
  }
`;
