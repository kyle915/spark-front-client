import { graphql } from "react-relay";

export const TenantUserQuery = graphql`
  query TenantUserQuery($userUuid: ID) {
  tenants(userUuid: $userUuid){
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
