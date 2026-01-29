import { graphql } from "react-relay";

export const ProductTypesQuery = graphql`
  query ProductTypesQuery(
    $filters: ProductTypeFiltersInput
    $first: Int
    $after: String
    $last: Int
    $before: String
    $q: String
  ) {
    productTypes(
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
          id
          uuid
          name
        }
      }
    }
  }
`;
