import { graphql } from "react-relay";

/**
 * Admin → many BAs. Fans a single message (with optional image/PDF
 * attachments) out to the 1:1 thread of every targeted BA and/or every
 * member of the targeted ambassador groups. Strictly tenant-scoped on
 * the server. A single-recipient send is just a broadcast of one.
 */
export const BroadcastChatMessageMutation = graphql`
  mutation BroadcastChatMessageMutation($input: BroadcastChatMessageInput!) {
    broadcastChatMessage(input: $input) {
      success
      message
      recipientCount
      threadUuids
    }
  }
`;
