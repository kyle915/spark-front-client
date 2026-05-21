import { graphql } from "react-relay";

/**
 * Per-tenant favorite-BA roster. Powers the Favorites tab and the
 * favorites-gating logic on Posted jobs.
 */
export const FavoriteAmbassadorsQuery = graphql`
  query FavoriteAmbassadorsQuery($tenantId: ID) {
    favoriteAmbassadors(tenantId: $tenantId) {
      uuid
      ambassadorId
      ambassadorUuid
      firstName
      lastName
      email
      note
      createdAt
    }
  }
`;
