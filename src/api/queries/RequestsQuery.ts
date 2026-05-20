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
          }
          # Used by the sidebar recap-due badge + the Master Tracker
          # RECAP chip. Just enough event/recap data — no fields
          # beyond id — so the per-row payload stays tiny.
          events {
            id
            recaps {
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
