import { graphql } from "react-relay";

/**
 * Retailer names that are exactly one store, for linking a chart row to its
 * store page. A banner with several locations under one name is left out.
 */
export const StoreLinksQuery = graphql`
  query StoreLinksQuery($tenantId: ID!) {
    tenantStoreLinks(tenantId: $tenantId) {
      name
      storeKey
    }
  }
`;
