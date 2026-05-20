import { graphql } from "react-relay";

export const UpdateAcademyModuleMutation = graphql`
  mutation UpdateAcademyModuleMutation($input: UpdateAcademyModuleInput!) {
    updateAcademyModule(input: $input) {
      success
      message
      academyModule {
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
  }
`;
