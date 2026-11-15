import { graphql } from "react-relay";

/**
 * Mark Missing Recaps rows as owing no recap, with a reason. Writes a
 * dismissal record only — no recap, booking or attendance row changes.
 * Returns the dismissal ids so the toast's "Undo" can restore them.
 */
export const DismissMissingRecapsMutation = graphql`
  mutation DismissMissingRecapsMutation($input: DismissMissingRecapsInput!) {
    dismissMissingRecaps(input: $input) {
      success
      message
      dismissedCount
      dismissalUuids
    }
  }
`;
