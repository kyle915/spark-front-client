import { graphql } from "react-relay";

export const RequestTypesQuery = graphql`
  query RequestTypesQuery($filters: RequestTypeFiltersInput!) {
    requestTypes(filters: $filters) {
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
