import { graphql } from "react-relay";

export const TenantQuery = graphql`
  query TenantQuery($userUuid: ID, $filters: TenantFiltersInput) {
    tenants(userUuid: $userUuid, filters: $filters) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          id
          uuid
          name
          requestUrlName
          image
        }
      }
    }
  }
`;
