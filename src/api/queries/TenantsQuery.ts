import { graphql } from "react-relay";

export const TenantsQuery = graphql`
  query TenantsQuery(
    $filters: TenantFiltersInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    tenants(
      filters: $filters
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          requestUrlName
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
