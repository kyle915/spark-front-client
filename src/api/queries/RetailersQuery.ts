import { graphql } from "react-relay";

export const RetailersQuery = graphql`
  query RetailersQuery($filters: RetailerFiltersInput!) {
    retailers(filters: $filters) {
      edges {
        node {
          __typename
          id
          uuid
          name
        }
      }
    }
  }
`;
