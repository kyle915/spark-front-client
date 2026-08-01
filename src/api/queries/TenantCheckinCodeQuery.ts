import { graphql } from "react-relay";

/**
 * The active tenant's STANDING check-in code, if one has been issued.
 *
 * Deliberately tiny and on its own (same shape as LinkedSheetQuery) so the
 * banner can mount anywhere without dragging in a heavier tenant payload.
 *
 * There is no tenant-by-id query on this schema, so we fetch the viewer's
 * tenants and pick the active one client-side — see useTenantCheckinCode.
 */
export const TenantCheckinCodeQuery = graphql`
  query TenantCheckinCodeQuery($userUuid: ID) {
    tenants(userUuid: $userUuid, first: 50) {
      edges {
        node {
          id
          uuid
          name
          checkinCode
        }
      }
    }
  }
`;

export default TenantCheckinCodeQuery;
