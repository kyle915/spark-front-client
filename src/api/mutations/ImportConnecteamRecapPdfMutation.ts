import { graphql } from "react-relay";

/**
 * Import a Connecteam-exported recap PDF and draft a CustomRecap.
 *
 * Backend parses Label:: Value pairs, fuzzy-matches them against the
 * CustomRecapTemplate's CustomField rows, and creates a CustomRecap +
 * CustomFieldValue rows for every matched non-empty value. It also
 * extracts embedded PDF photos and reports how many it attached
 * (`imagesAttached`) — the UI opens the drafted recap for review/edit/
 * approve, and routes the admin into the manual photo-upload workflow
 * when `imagesAttached` is 0.
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
      imagesAttached
      queued
      jobId
      customRecap {
        id
        uuid
        name
      }
    }
  }
`;
