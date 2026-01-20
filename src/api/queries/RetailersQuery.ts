import { graphql } from "react-relay";

export const RetailersQuery = graphql`
  query RetailersQuery($filters: RetailerFiltersInput!, $q: String) {
    retailers(filters: $filters, q: $q) {
      edges {
        node {
          __typename
          id
          uuid
          name
          address
          storeContact
        }
      }
    }
  }
`;
