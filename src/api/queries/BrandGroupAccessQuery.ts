import { graphql } from "react-relay";

/** Client users granted the Compare brands tab (Ignite staff only). */
export const BrandGroupAccessQuery = graphql`
  query BrandGroupAccessQuery($tenantId: ID!) {
    brandGroupAccess(tenantId: $tenantId) {
      userPk
      email
      name
      grantedAt
    }
  }
`;
