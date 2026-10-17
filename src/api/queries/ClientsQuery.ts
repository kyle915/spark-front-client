import { graphql } from "react-relay";

export const ClientsQuery = graphql`
  query ClientsQuery($filters: ClientFiltersInput!, $first: Int, $after: String) {
    clients(filters: $filters, first: $first, after: $after) {
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          email
          tenantId
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;
