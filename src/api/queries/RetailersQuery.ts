import { graphql } from "react-relay";

export const RetailersQuery = graphql`
  query RetailersQuery(
    $filters: RetailerFiltersInput!
    $q: String
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    retailers(
      filters: $filters
      q: $q
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          address
          storeContact
          location {
            state {
              id
              name
              code
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
