import { graphql } from "react-relay";

export const DistributorsQuery = graphql`
  query DistributorsQuery($filters: DistributorFiltersInput!) {
    distributors(filters: $filters) {
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
