import { graphql } from "react-relay";

export const TenantQuery = graphql`
 query TenantQuery($userUuid: ID) {
  tenants(userUuid: $userUuid) {
    totalCount
    pageInfo{
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
      }
    }
  }
}

`;
