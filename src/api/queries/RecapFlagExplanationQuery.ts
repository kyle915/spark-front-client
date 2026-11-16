import { graphql } from "react-relay";

/**
 * One plain line for the reviewer: why this recap was flagged and what to
 * look at first. Staff only — the server returns null for a brand user, and
 * null when nothing is flagged. `summary` is null when there is no line to
 * show (several flags and no model); the checks below it are then the whole
 * story, as before. Never approves or edits anything.
 */
export const RecapFlagExplanationQuery = graphql`
  query RecapFlagExplanationQuery($recapId: ID!, $isCustom: Boolean!) {
    recapFlagExplanation(recapId: $recapId, isCustom: $isCustom) {
      summary
      source
      flagCount
    }
  }
`;
