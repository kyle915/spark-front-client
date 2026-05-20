import { graphql } from "react-relay";

export const DeleteAcademyModuleMutation = graphql`
  mutation DeleteAcademyModuleMutation($input: DeleteAcademyModuleInput!) {
    deleteAcademyModule(input: $input) {
      success
      message
    }
  }
`;
