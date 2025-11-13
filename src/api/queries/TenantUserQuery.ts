import { graphql } from "react-relay";

export const TenantUserQuery = graphql`
  query TenantUserQuery($userUuid: ID) {
  tenants(userUuid: $userUuid){
    id
    uuid
    name
  }
}
`;
