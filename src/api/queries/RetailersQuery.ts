import { graphql } from "react-relay";

export const RetailersQuery = graphql`
  query RetailersQuery(
    $filters: RetailerFiltersInput!
    $q: String
    $first: Int
    $after: String
  ) {
    retailers(filters: $filters, q: $q, first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          address
          storeContact
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
