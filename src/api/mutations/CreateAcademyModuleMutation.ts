import { graphql } from "react-relay";

export const CreateAcademyModuleMutation = graphql`
  mutation CreateAcademyModuleMutation($input: CreateAcademyModuleInput!) {
    createAcademyModule(input: $input) {
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
