import { graphql } from "react-relay";

/**
 * Client invoices for the admin Billing dashboard.
 *
 * Backs the invoice list: one row per invoice (number, client, status,
 * total, issue/due dates). Filters are tenant / status scoped on the
 * server. Selects every field incl. lineItems + shareToken so the list,
 * the edit modal, the share link and the PDF link can all be built from a
 * single fetch without a follow-up per-invoice query.
 */
export const InvoicesQuery = graphql`
  query InvoicesQuery($filters: InvoiceFiltersInput) {
    invoices(filters: $filters) {
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
