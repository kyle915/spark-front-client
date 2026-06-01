import { graphql } from "react-relay";

export const RequestsQuery = graphql`
  query RequestsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $q: String
    $filters: RequestFiltersInput
  ) {
    requests(
      first: $first
      after: $after
      last: $last
      before: $before
      q: $q
      filters: $filters
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          date
          startTime
          endTime
          address
          coordinates
          schedulingStatus
          location {
            id
            name
          }
          state {
            id
            name
            code
          }
          client {
            __typename
            id
            uuid
            name
          }
          distributor {
            __typename
            id
            uuid
            name
          }
          retailer {
            __typename
            id
            uuid
            name
            location {
              id
              name
              state {
                id
                name
                code
              }
            }
          }
          requestType {
            __typename
            id
            uuid
            name
          }
          status {
            __typename
            id
            uuid
            name
            slug
          }
          event {
            __typename
            id
            uuid
            name
            assignedAmbassadorsCount
            confirmedAmbassadorsCount
          }
          # Used by the sidebar recap-due badge + the Master Tracker
          # RECAP chip. Just enough event/recap data — id + uuid + the
          # recap counts — so the per-row payload stays tiny. The uuid
          # lets a "N RECAP" row click navigate to the specific event
          # that actually holds the recap, not just the first event.
          events {
            id
            uuid
            recaps {
              id
            }
            # Custom-template recaps count toward the RECAP chip too — an
            # event is "filed" when EITHER list is non-empty (matches
            # /recaps/missing). Prefetched server-side, so no N+1.
            customRecaps {
              id
            }
          }
          tenantId
          createdAt
          updatedAt
        }
      }
    }
  }
`;
