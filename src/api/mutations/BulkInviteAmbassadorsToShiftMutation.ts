import { graphql } from "react-relay";

/**
 * Invite many BAs to one shift in a single round-trip.
 *
 * Backs the "Invite selected" bulk action in the Smart-staffing
 * panel. The server creates one AmbassadorEvent (is_approved=False)
 * per ambassador id that isn't already on the shift — each fires the
 * existing "New shift offered" push — and reports back how many were
 * `invited` vs `skipped` (already invited / already assigned / not
 * eligible) so the panel can toast "Invited X, skipped Y".
 */
export const BulkInviteAmbassadorsToShiftMutation = graphql`
  mutation BulkInviteAmbassadorsToShiftMutation(
    $input: BulkInviteToShiftInput!
  ) {
    bulkInviteAmbassadorsToShift(input: $input) {
      success
      message
      invited
      skipped
    }
  }
`;
