import { graphql } from "react-relay";

/**
 * Tenant-wide audit feed. Pulls RequestActivityLog rows across
 * every request in the current tenant — newest-first, capped at 200
 * server-side. Powers the /audit admin page.
 */
export const ActivityLogsQuery = graphql`
  query ActivityLogsQuery($first: Int, $kind: String) {
    activityLogs(first: $first, kind: $kind) {
      uuid
      kind
      summary
      metadataJson
      actorEmail
      actorName
      createdAt
    }
  }
`;
