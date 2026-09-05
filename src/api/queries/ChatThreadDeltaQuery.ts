import { graphql } from "react-relay";

/** Newer messages since afterUuid — poll without remounting the thread. */
export const ChatThreadDeltaQuery = graphql`
  query ChatThreadDeltaQuery($uuid: ID!, $first: Int!, $afterUuid: String) {
    chatThread(uuid: $uuid) {
      id
      uuid
      unreadForAdmin
      messages(first: $first, afterUuid: $afterUuid) {
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
