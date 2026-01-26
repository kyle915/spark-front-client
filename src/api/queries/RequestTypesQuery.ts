import { graphql } from "react-relay";

export const RequestTypesQuery = graphql`
  query RequestTypesQuery(
    $filters: RequestTypeFiltersInput!
    $q: String
    $first: Int
    $after: String
  ) {
    requestTypes(filters: $filters, q: $q, first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          id
          uuid
          name
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
