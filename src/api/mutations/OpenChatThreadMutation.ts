import { graphql } from "react-relay";

export const OpenChatThreadMutation = graphql`
  mutation OpenChatThreadMutation($input: OpenChatThreadInput!) {
    openChatThread(input: $input) {
      id
      uuid
      kind
      jobUuid
      jobName
    }
  }
`;
