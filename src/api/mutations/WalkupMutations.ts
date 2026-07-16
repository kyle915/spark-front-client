import { graphql } from "react-relay";

/**
 * Walk-up self-serve clock-in — admin mutations.
 * generate/revoke a per-event code; confirm/reject a walk-up in the queue.
 * Operation names are prefixed with the module name (WalkupMutations) as
 * relay-compiler requires.
 */
export const GenerateWalkupCodeMutation = graphql`
  mutation WalkupMutationsGenerateMutation($input: GenerateWalkupCodeInput!) {
    generateWalkupCode(input: $input) {
      success
      message
      code
      expiresAt
    }
  }
`;

export const RevokeWalkupCodeMutation = graphql`
  mutation WalkupMutationsRevokeMutation($input: GenerateWalkupCodeInput!) {
    revokeWalkupCode(input: $input) {
      success
      message
    }
  }
`;

export const ConfirmWalkupShiftMutation = graphql`
  mutation WalkupMutationsConfirmMutation($input: ConfirmWalkupShiftInput!) {
    confirmWalkupShift(input: $input) {
      success
      message
    }
  }
`;

export const RejectWalkupShiftMutation = graphql`
  mutation WalkupMutationsRejectMutation($input: RejectWalkupShiftInput!) {
    rejectWalkupShift(input: $input) {
      success
      message
    }
  }
`;
