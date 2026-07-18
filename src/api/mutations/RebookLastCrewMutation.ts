import { graphql } from "react-relay";

/**
 * Book the same crew that worked this venue last time onto this shift —
 * the Staffing Board's "re-book last crew" one-click. Idempotent server-side.
 */
export const RebookLastCrewMutation = graphql`
  mutation RebookLastCrewMutation($input: RebookLastCrewInput!) {
    rebookLastCrew(input: $input) {
      success
      message
      assignedCount
      failedCount
    }
  }
`;
