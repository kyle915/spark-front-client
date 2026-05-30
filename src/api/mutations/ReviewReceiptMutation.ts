import { graphql } from "react-relay";

/**
 * Validate or reject a consumer receipt.
 *
 * status must be validated or rejected. The optional note is the
 * reviewer's reason, surfaced back on the receipt. The mutation returns
 * the updated receipt so Relay can refresh the row status in place
 * without a refetch.
 */
export const ReviewReceiptMutation = graphql`
  mutation ReviewReceiptMutation($input: ReviewReceiptInput!) {
    reviewReceipt(input: $input) {
      success
      message
      clientMutationId
      receipt {
        __typename
        id
        uuid
        status
        reviewNote
        reviewedAt
        reviewedBy {
          __typename
          uuid
          email
          firstName
          lastName
        }
      }
    }
  }
`;
