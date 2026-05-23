import { graphql } from "react-relay";

/**
 * Import a Connecteam-exported recap PDF and draft a CustomRecap.
 *
 * Backend parses Label:: Value pairs, fuzzy-matches them against the
 * CustomRecapTemplate's CustomField rows, and creates a CustomRecap +
 * CustomFieldValue rows for every matched non-empty value. The stats
 * array tells us which labels mapped where (and which fell on the
 * floor) so the UI can surface anything the admin needs to enter by
 * hand. Receipt photos are uploaded separately via the existing
 * CustomRecapFile flow.
 */
export const ImportConnecteamRecapPdfMutation = graphql`
  mutation ImportConnecteamRecapPdfMutation(
    $input: ImportConnecteamRecapPdfInput!
  ) {
    importConnecteamRecapPdf(input: $input) {
      success
      message
      matchedCount
      unmatchedCount
      stats {
        pdfLabel
        pdfValue
        fieldName
        fieldId
        score
        skippedReason
      }
      customRecap {
        id
        uuid
        name
      }
    }
  }
`;
