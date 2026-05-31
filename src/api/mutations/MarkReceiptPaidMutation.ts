import { graphql } from "react-relay";

/**
 * Mark a validated consumer receipt as paid.
 *
 * Spark does NOT move money — the admin opens the receipt's payoutLink
 * (Venmo) to pay the consumer the reward, then calls this to record the
 * payout. Reuses ReviewReceiptResponse; returns the updated receipt so the
 * queue can move the row into the Paid tab without a refetch.
 */
export const MarkReceiptPaidMutation = graphql`
  mutation MarkReceiptPaidMutation($input: MarkReceiptPaidInput!) {
    markReceiptPaid(input: $input) {
      success
      message
      clientMutationId
      receipt {
        id
        status
        paidAt
        rewardAmount
        payoutLink
      }
    }
  }
`;
