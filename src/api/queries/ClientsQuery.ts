import { graphql } from "react-relay";

export const ClientsQuery = graphql`
  query ClientsQuery($filters: ClientFiltersInput!) {
    clients(filters: $filters) {
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
