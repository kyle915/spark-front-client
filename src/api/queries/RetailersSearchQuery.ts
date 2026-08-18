import { graphql } from "react-relay";

export const RetailersSearchQuery = graphql`
  query RetailersSearchQuery($q: String, $first: Int, $filters: RetailerFiltersInput) {
    retailers(q: $q, first: $first, filters: $filters) {
      edges {
        node {
          id
          uuid
          name
          address
          isNational
        }
      }
    }
  }
`;
