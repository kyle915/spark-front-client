import { graphql } from "react-relay";

/**
 * Stores to sample next for one client, ranked on the server, each with
 * its reason. Null for anyone the server does not show it to.
 */
export const TenantSampleNextQuery = graphql`
  query TenantSampleNextQuery($tenantId: ID!) {
    tenantSampleNext(tenantId: $tenantId) {
      items {
        key
        kind
        name
        address
        market
        reason
        lat
        lng
      }
    }
  }
`;
