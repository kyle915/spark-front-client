import { graphql } from "react-relay";

/**
 * Create a client invoice for a tenant.
 *
 * Line items are sent as InvoiceLineItemInput[] with numeric quantity /
 * unitPrice (Floats); the server computes amount, subtotal, tax and total
 * and echoes them back as formatted strings. taxRate is a percentage Float.
 * Returns the created invoice so the Billing dashboard can refresh in place.
 */
export const CreateInvoiceMutation = graphql`
  mutation CreateInvoiceMutation($input: CreateInvoiceInput!) {
    createInvoice(input: $input) {
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
