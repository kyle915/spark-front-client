import { graphql } from "react-relay";

/**
 * Fetch the audit-log timeline for a single request. Returns the
 * latest 200 entries newest-first (backend-enforced).
 *
 * Loaded lazily via Suspense inside the ActivityLogPanel — failure
 * here should never block the rest of the request detail page.
 */
export const RequestActivityLogQuery = graphql`
  query RequestActivityLogQuery($uuid: ID!) {
    request(uuid: $uuid) {
      uuid
      activityLog {
        uuid
        kind
        summary
        metadataJson
        actorEmail
        actorName
        createdAt
      }
    }
  }
`;
