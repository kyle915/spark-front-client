import { graphql } from "react-relay";

/**
 * Single batched Jump (Cmd+K) search query replacing 6 parallel GraphQL
 * requests per keystroke.
 */
export const JumpSearchQuery = graphql`
  query JumpSearchQuery($q: String!, $tenantId: ID, $first: Int) {
    jumpSearch(q: $q, tenantId: $tenantId, first: $first) {
      requests {
        uuid
        name
        date
        retailerName
      }
      events {
        uuid
        name
        date
        address
        retailerName
      }
      stores {
        key
        storeKey
        name
        address
        city
        state
      }
      recaps {
        uuid
        kind
        name
        approved
        eventDate
      }
      ambassadors {
        uuid
        name
        email
      }
      clients {
        uuid
        name
        email
        tenantId
        tenantUuid
        tenantName
        slug
        checkinCode
      }
    }
  }
`;
