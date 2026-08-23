import { graphql } from "react-relay";

/**
 * Per-tenant Google Sheet append observability — last sync time, error,
 * and the request that triggered the most recent row append.
 */
export const LinkedSheetIntegrationQuery = graphql`
  query LinkedSheetIntegrationQuery($userUuid: ID) {
    tenants(userUuid: $userUuid, first: 50) {
      edges {
        node {
          id
          uuid
          name
          linkedSheetUrl
          linkedSheetLastSyncAt
          linkedSheetLastSyncError
          linkedSheetLastRequestId
        }
      }
    }
  }
`;
