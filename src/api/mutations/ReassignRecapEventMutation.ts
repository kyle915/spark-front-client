import { graphql } from "react-relay";

/**
 * Move a recap from one Event to another within the same tenant.
 *
 * Fixes wrong-event mis-links (BA picked the wrong shift when filing)
 * without forcing a re-file. Backend enforces same-tenant guard;
 * cross-tenant moves are rejected with a structured error.
 */
export const ReassignRecapEventMutation = graphql`
  mutation ReassignRecapEventMutation($input: ReassignRecapEventInput!) {
    reassignRecapEvent(input: $input) {
      success
      message
      recap {
        id
        uuid
        eventId
        event {
          id
          uuid
          name
        }
      }
    }
  }
`;
