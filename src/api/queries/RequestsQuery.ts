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
          # Just enough event/recap data to render the recap-status
          # chip on each Master Tracker row. We deliberately don't
          # ask for any recap fields beyond id so the row payload
          # stays tiny (avg under 100 bytes overhead per request).
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
