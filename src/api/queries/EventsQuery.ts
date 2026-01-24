import { graphql } from "react-relay";

export const EventsQuery = graphql`
  query EventsQuery(
    $filters: EventFiltersInput
    $q: String
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    events(
      filters: $filters
      q: $q
      first: $first
      after: $after
      last: $last
      before: $before
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
          timezone {
            __typename
            id
            uuid
            name
            code
            offset
          }
          startTime
          endTime
          address
          isNational
          notes
          request {
            __typename
            id
            uuid
            name
            date
            retailer {
              __typename
              id
              uuid
              name
            }
          }
          tenantId
          eventType {
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
        }
      }
    }
  }
`;
