import { graphql } from "react-relay";

export const EventTypeQuery = graphql`
  query EventTypeQuery(
    $filters: EventTypeFiltersInput!
    $first: Int
    $after: String
    $last: Int
    $before: String
    $q: String
  ) {
    eventTypes(
      filters: $filters
      first: $first
      after: $after
      last: $last
      before: $before
      q: $q
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        node {
          __typename
          id
          uuid
          name
          isDefault
          tenantId
        }
      }
    }
  }
`;
