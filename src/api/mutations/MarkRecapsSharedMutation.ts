import { graphql } from "react-relay";

export const MarkRecapsSharedMutation = graphql`
  mutation MarkRecapsSharedMutation($input: MarkRecapsSharedInput!) {
    markRecapsShared(input: $input) {
      success
      message
      updatedCount
    }
  }
`;
