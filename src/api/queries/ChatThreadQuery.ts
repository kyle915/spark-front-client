import { graphql } from "react-relay";

export const ChatThreadQuery = graphql`
  query ChatThreadQuery($uuid: ID!) {
    chatThread(uuid: $uuid) {
      id
      uuid
      kind
      ambassadorUuid
      ambassadorName
      jobUuid
      jobName
      unreadForAdmin
      messages(first: 100) {
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
