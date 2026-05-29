import { graphql } from "react-relay";

/**
 * Admin soft-delete of a chat thread (the trash action on a thread row).
 * Sets archived_at server-side so the thread drops out of the default
 * chat list without purging the thread or its messages — reversible via
 * archived: false. Tenant-scoped + admin-only on the server.
 */
export const ArchiveChatThreadMutation = graphql`
  mutation ArchiveChatThreadMutation($input: ArchiveChatThreadInput!) {
    archiveChatThread(input: $input) {
      id
      uuid
      archivedAt
    }
  }
`;
