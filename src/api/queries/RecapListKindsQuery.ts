import { graphql } from "react-relay";

/**
 * Tenant-level EXISTS flags so Recaps list can skip unused legacy/custom
 * page-1 queries without a filtered totalCount probe waterfall.
 */
export const RecapListKindsQuery = graphql`
  query RecapListKindsQuery($tenantId: ID) {
    recapListKinds(tenantId: $tenantId) {
      hasLegacy
      hasCustom
    }
  }
`;
