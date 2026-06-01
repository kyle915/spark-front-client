import { graphql } from "react-relay";

/**
 * The admin's tenant-scoped shortlist of favorited BAs. Returns the
 * denormalized TenantFavoriteAmbassador rows so the Favorites page can
 * render the roster without a second hop back to Ambassador.
 *
 * Backed by the live `favoriteAmbassadors(tenantId)` op. `tenantId` is
 * optional server-side (falls back to the caller's active tenant) but
 * the client always passes the value from the auth store.
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
