import { graphql } from "react-relay";

/**
 * Look up map positions for a batch of list rows that have an address and no
 * position yet. Call again while `remaining` is above zero.
 */
export const PlaceAccountListEntriesMutation = graphql`
  mutation PlaceAccountListEntriesMutation($tenantId: ID!, $limit: Int) {
    placeAccountListEntries(tenantId: $tenantId, limit: $limit) {
      placed
      notFound
      remaining
      lookupAvailable
    }
  }
`;
