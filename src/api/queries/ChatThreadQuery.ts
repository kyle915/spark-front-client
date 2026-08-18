import { graphql } from "react-relay";

export const ChatThreadQuery = graphql`
  query ChatThreadQuery($uuid: ID!, $first: Int!, $beforeUuid: String) {
    chatThread(uuid: $uuid) {
      id
      uuid
      kind
      ambassadorUuid
      ambassadorName
      jobUuid
      jobName
      unreadForAdmin
      messages(first: $first, beforeUuid: $beforeUuid) {
        id
        uuid
        body
        senderIsAmbassador
        senderName
        createdAt
        attachments {
          id
          uuid
          kind
          url
          originalFilename
          contentType
          byteSize
        }
      }
    }
  }
`;
