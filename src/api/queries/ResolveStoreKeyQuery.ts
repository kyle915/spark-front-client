import { graphql } from "react-relay";

/**
 * Resolve any store reference (storeKey, requestId, recapId, address, or
 * unambiguous storeName) to its canonical `s<pk>` storeKey for the active brand.
 */
export const ResolveStoreKeyQuery = graphql`
  query ResolveStoreKeyQuery(
    $tenantId: ID!
    $storeKey: String
    $requestId: ID
    $recapId: ID
    $storeName: String
    $address: String
  ) {
    resolveStoreKey(
      tenantId: $tenantId
      storeKey: $storeKey
      requestId: $requestId
      recapId: $recapId
      storeName: $storeName
      address: $address
    )
  }
`;
