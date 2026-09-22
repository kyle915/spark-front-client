import { graphql } from "react-relay";

export const RenameCatalogLabelMutation = graphql`
  mutation RenameCatalogLabelMutation($input: RenameCatalogLabelInput!) {
    renameCatalogLabel(input: $input) {
      success
      message
      recapsUpdated
      clientMutationId
    }
  }
`;
