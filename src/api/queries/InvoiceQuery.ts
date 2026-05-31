import { graphql } from "react-relay";

/**
 * A single invoice by id.
 *
 * Selects all fields incl. lineItems + shareToken so a detail/edit view
 * can be hydrated directly. Mirrors the field set of InvoicesQuery.
 */
export const InvoiceQuery = graphql`
  query InvoiceQuery($id: ID!) {
    invoice(id: $id) {
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
`;
