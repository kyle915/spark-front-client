import { graphql } from "react-relay";

export const CancelShiftInviteMutation = graphql`
  mutation CancelShiftInviteMutation($input: CancelShiftInviteInput!) {
    cancelShiftInvite(input: $input) {
      success
      message
      ambassadorEventUuid
    }
  }
`;
