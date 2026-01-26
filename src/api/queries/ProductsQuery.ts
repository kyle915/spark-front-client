import { graphql } from "react-relay";

export const ProductsQuery = graphql`
  query ProductsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: ProductFiltersInput
    $q: String
  ) {
    products(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
      q: $q
    ) {
      totalCount
      edges {
        cursor
        node {
          id
          uuid
          name
          image
          tenantId
          productType {
            id
            name
          }
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
