import { graphql } from "react-relay";

/**
 * Approve a pending Ambassador profile.
 *
 * Flips Ambassador.is_active to True so the BA can be invited to
 * shifts. Same mutation the existing People row "approve" buttons
 * use — we just lift it here so the /people/pending queue can
 * one-click approve from the list.
 */
export const ApproveAmbassadorMutation = graphql`
  mutation ApproveAmbassadorMutation($input: ApproveAmbassadorInput!) {
    approveAmbassador(input: $input) {
      success
      message
      ambassador {
        id
        uuid
        isActive
      }
    }
  }
`;
