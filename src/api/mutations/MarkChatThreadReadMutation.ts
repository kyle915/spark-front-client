import { graphql } from "react-relay";

export const MarkChatThreadReadMutation = graphql`
  mutation MarkChatThreadReadMutation($input: MarkChatThreadReadInput!) {
    markChatThreadRead(input: $input)
  }
`;
