import { graphql } from "react-relay";

export const ChatThreadsQuery = graphql`
  query ChatThreadsQuery {
    chatThreads {
      id
      uuid
      kind
      lastMessageAt
      lastMessagePreview
      lastMessageSenderIsAmbassador
      ambassadorUuid
      ambassadorName
      jobUuid
      jobName
      unreadForAdmin
    }
  }
`;
