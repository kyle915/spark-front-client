import { graphql } from "react-relay";

export const DistributorsQuery = graphql`
  query DistributorsQuery($filters: DistributorFiltersInput!, $q: String) {
    distributors(filters: $filters, q: $q) {
      edges {
        node {
          __typename
          id
          uuid
          name
          email
        }
      }
    }
  }
`;
