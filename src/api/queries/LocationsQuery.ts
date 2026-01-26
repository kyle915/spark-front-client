import { graphql } from "react-relay";

export const LocationsQuery = graphql`
  query LocationsQuery(
    $filters: LocationFiltersInput!
    $q: String
    $first: Int
    $after: String
  ) {
    locations(filters: $filters, q: $q, first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          id
          uuid
          name
          code
          zip
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
