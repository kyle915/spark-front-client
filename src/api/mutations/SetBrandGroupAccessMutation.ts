import { graphql } from "react-relay";

export const SetBrandGroupAccessMutation = graphql`
  mutation SetBrandGroupAccessMutation(
    $tenantId: ID!
    $email: String!
    $granted: Boolean!
  ) {
    setBrandGroupAccess(tenantId: $tenantId, email: $email, granted: $granted) {
      userPk
      email
      name
      grantedAt
    }
  }
`;
