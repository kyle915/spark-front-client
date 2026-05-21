import { graphql } from "react-relay";

/**
 * Approve / decline a custom recap. On approval, the backend fires
 * RecapApprovedNotificationMailer to the RMM, client tenanted users,
 * and the original requestor — with the latest PDF attached when one
 * exists.
 */
export const ApproveCustomRecapMutation = graphql`
  mutation CustomRecapApprovalMutations_ApproveMutation(
    $input: ApproveCustomRecapInput!
  ) {
    approveCustomRecap(input: $input) {
      success
      message
      customRecap {
        id
        uuid
        approved
      }
    }
  }
`;

/**
 * Trigger server-side PDF rebuild for this custom recap. The PDF
 * gets stored as a CustomRecapFile so the approval email picks it
 * up automatically on the next approval action.
 */
export const GenerateCustomRecapPdfMutation = graphql`
  mutation CustomRecapApprovalMutations_GeneratePdfMutation(
    $input: GenerateCustomRecapPdfInput!
  ) {
    generateCustomRecapPdf(input: $input) {
      success
      message
      customRecapFile {
        id
        uuid
        name
        url
      }
    }
  }
`;

export const DeclineCustomRecapMutation = graphql`
  mutation CustomRecapApprovalMutations_DeclineMutation(
    $input: DeclineCustomRecapInput!
  ) {
    declineCustomRecap(input: $input) {
      success
      message
      customRecap {
        id
        uuid
        approved
      }
    }
  }
`;
