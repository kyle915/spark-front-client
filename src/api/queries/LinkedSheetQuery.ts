import { graphql } from "react-relay";

/**
 * Tiny tenant fetch that returns just the linked-sheet URL plus the
 * uuid the setLinkedSheet mutation needs. Lives on its own so the
 * LinkedSheetChip + Settings page can subscribe to changes without
 * pulling the much bigger TenantsQuery payload.
 */
export const LinkedSheetQuery = graphql`
  query LinkedSheetQuery($userUuid: ID) {
    tenants(userUuid: $userUuid, first: 50) {
      edges {
        node {
          id
          uuid
          linkedSheetUrl
        }
      }
    }
  }
`;
