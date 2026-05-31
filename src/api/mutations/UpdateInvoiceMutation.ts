import { graphql } from "react-relay";

/**
 * Update an existing invoice.
 *
 * Sending lineItems REPLACES the invoice's line items wholesale (the form
 * always submits the full current set). The server recomputes amount,
 * subtotal, tax and total. Returns the updated invoice so the dashboard
 * refreshes in place.
 */
export const UpdateInvoiceMutation = graphql`
  mutation UpdateInvoiceMutation($input: UpdateInvoiceInput!) {
    updateInvoice(input: $input) {
      success
      message
      clientMutationId
      invoice {
        id
        uuid
        number
        status
        clientName
        issueDate
        dueDate
        currency
        notes
        subtotal
        taxRate
        taxAmount
        total
        lineItems {
          id
          description
          quantity
          unitPrice
          amount
          eventId
          sortOrder
        }
        sentAt
        paidAt
        shareToken
        createdAt
        updatedAt
      }
    }
  }
`;
