import { graphql } from "react-relay";

/**
 * Month-end BA expense receipts export — returns the bookkeeping CSV
 * inline (saved client-side as a Blob, no second round trip) plus a
 * GCS URL for the PDF bundle of receipt images. Covers BOTH recap
 * families server-side (custom receipt-category files / spend fields
 * and legacy accountSpendAmount rows), scoped by event date.
 */
export const ExportExpenseReceiptsMutation = graphql`
  mutation ExportExpenseReceiptsMutation(
    $input: ExportExpenseReceiptsInput!
  ) {
    exportExpenseReceipts(input: $input) {
      success
      message
      csvText
      pdfUrl
      recapCount
      receiptCount
      totalSpend
    }
  }
`;
