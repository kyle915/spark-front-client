import { graphql } from "react-relay";

/**
 * Clone a request N times with per-copy date (and optional venue)
 * overrides. Powers the "⎘ Clone ×N" action on Master Tracker.
 *
 * Caps at 50 copies per call (mirrored from backend). Returns the
 * new request UUIDs so the UI can deep-link or refresh.
 */
export const BulkCloneRequestMutation = graphql`
  mutation BulkCloneRequestMutation($input: BulkCloneRequestInput!) {
    bulkCloneRequest(input: $input) {
      success
      message
      createdCount
      createdUuids
    }
  }
`;
