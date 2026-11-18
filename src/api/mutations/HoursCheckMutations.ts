import { graphql } from "react-relay";

/**
 * Mark one hours-check flag "OK — reviewed" (records who + when + note) so
 * it stops asking until the facts behind it change. `undo: true` removes it.
 */
export const MarkHoursFlagReviewedMutation = graphql`
  mutation HoursCheckMutationsMarkReviewedMutation(
    $input: MarkHoursFlagReviewedInput!
  ) {
    markHoursFlagReviewed(input: $input) {
      success
      message
      reviewedBy
      reviewedAt
    }
  }
`;
