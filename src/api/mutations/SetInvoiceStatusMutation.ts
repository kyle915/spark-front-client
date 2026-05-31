import { graphql } from "react-relay";

/**
 * Transition an invoice's status (draft → sent → paid / void).
 *
 * The server stamps sentAt / paidAt as appropriate and returns the key
 * fields so the row updates in place without a refetch.
 */
export const SetInvoiceStatusMutation = graphql`
  mutation SetInvoiceStatusMutation($input: SetInvoiceStatusInput!) {
    setInvoiceStatus(input: $input) {
      success
      message
      clientMutationId
      invoice {
        id
        uuid
        number
        status
        total
        sentAt
        paidAt
        updatedAt
      }
    }
  }
`;
