import { graphql } from "react-relay";

/**
 * Delete an invoice.
 *
 * The backend decides whether to hard-delete or soft-void; we just surface
 * its message and refetch the list. Returns the key fields of the affected
 * invoice (may be null when hard-deleted).
 */
export const DeleteInvoiceMutation = graphql`
  mutation DeleteInvoiceMutation($input: DeleteInvoiceInput!) {
    deleteInvoice(input: $input) {
      success
      message
      clientMutationId
      invoice {
        id
        uuid
        number
        status
      }
    }
  }
`;
