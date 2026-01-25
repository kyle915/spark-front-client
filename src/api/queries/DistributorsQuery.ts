import { graphql } from "react-relay";

export const DistributorsQuery = graphql`
  query DistributorsQuery(
    $filters: DistributorFiltersInput!
    $q: String
    $first: Int
    $after: String
  ) {
    distributors(filters: $filters, q: $q, first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          id
          uuid
          name
          email
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;
