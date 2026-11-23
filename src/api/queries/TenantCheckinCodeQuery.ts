import { graphql } from "react-relay";

/**
 * The active tenant's STANDING check-in code and Studio config.
 *
 * Deliberately on its own (same shape as LinkedSheetQuery) so the Walk-ups
 * Standing tab can mount without dragging in a heavier tenant payload.
 *
 * There is no tenant-by-id query on this schema, so we fetch the viewer's
 * tenants and pick the active one client-side — see usePublicFormLink.
 */
export const TenantCheckinCodeQuery = graphql`
  query TenantCheckinCodeQuery($userUuid: ID) {
    tenants(userUuid: $userUuid, first: 500) {
      edges {
        node {
          id
          uuid
          name
          requestUrlName
          checkinCode
          checkinTeamCode
          checkinTeamTitle
          checkinPhotoBuckets
          checkinEventTypeNames
          checkinLocationMode
          checkinPhotoBucketsConfig
          checkinResources {
            label
            kind
            url
            note
            hideOnRecapOnly
          }
          checkinPrograms {
            id
            name
            isDefault
          }
        }
      }
    }
  }
`;

export default TenantCheckinCodeQuery;
