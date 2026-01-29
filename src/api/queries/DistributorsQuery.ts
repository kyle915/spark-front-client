import { graphql } from "react-relay";

export const DistributorsQuery = graphql`
  query DistributorsQuery(
    $filters: DistributorFiltersInput!
    $q: String
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    distributors(
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
          email
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
