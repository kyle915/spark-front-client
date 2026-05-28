import { graphql } from "react-relay";

export const SendChatMessageMutation = graphql`
  mutation SendChatMessageMutation($input: SendChatMessageInput!) {
    sendChatMessage(input: $input) {
      id
      uuid
      body
      senderIsAmbassador
      senderName
      createdAt
    }
  }
`;
