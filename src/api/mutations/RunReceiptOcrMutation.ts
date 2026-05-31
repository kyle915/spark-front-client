import { graphql } from "react-relay";

/**
 * Run OCR against a consumer receipt's uploaded image (admin-triggered).
 *
 * On success the backend returns the receipt with its ocr* fields
 * populated so the admin can compare the read-off values against what the
 * consumer typed. Reuses ReviewReceiptResponse; OCR may be unavailable, in
 * which case success is false and `message` explains why. Selecting the ocr
 * fields lets Relay patch the row in place without a refetch.
 */
export const RunReceiptOcrMutation = graphql`
  mutation RunReceiptOcrMutation($input: RunReceiptOcrInput!) {
    runReceiptOcr(input: $input) {
      success
      message
      clientMutationId
      receipt {
        id
        ocrStore
        ocrAmount
        ocrDate
        ocrText
        ocrRanAt
      }
    }
  }
`;
