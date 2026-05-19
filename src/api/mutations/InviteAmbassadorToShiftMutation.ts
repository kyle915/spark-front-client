import { graphql } from "react-relay";

/**
 * Admin invites a specific BA to a specific event. Creates an
 * AmbassadorEvent (is_approved=False), which fires the existing
 * post_save signal → "New shift offered" push to the BA's mobile
 * device.
 */
export const InviteAmbassadorToShiftMutation = graphql`
  mutation InviteAmbassadorToShiftMutation(
    $input: InviteAmbassadorToShiftInput!
  ) {
    inviteAmbassadorToShift(input: $input) {
      success
      message
      ambassadorEventUuid
    }
  }
`;
