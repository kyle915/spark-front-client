import { graphql } from "react-relay";

/** The store a recap was filed at, for the link on its store name. */
export const RecapStoreKeyQuery = graphql`
  query RecapStoreKeyQuery($tenantId: ID!, $recapId: ID!) {
    recapStoreKey(tenantId: $tenantId, recapId: $recapId)
  }
`;
