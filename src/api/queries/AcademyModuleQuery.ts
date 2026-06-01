import { graphql } from "react-relay";

export const AcademyModuleQuery = graphql`
  query AcademyModuleQuery($uuid: ID!) {
    academyModule(uuid: $uuid) {
      id
      uuid
      title
      kind
      body
      order
      published
      createdAt
      updatedAt
      tenantId
    }
  }
`;
