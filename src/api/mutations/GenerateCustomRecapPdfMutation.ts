import { graphql } from "react-relay";

/**
 * Generate (or regenerate) the PDF for a custom recap. Mirrors
 * GenerateRecapPdfMutation but targets the custom-recap resolver and
 * selects from CustomRecapFileDetailResponse.
 *
 * NB: CustomRecapFile exposes url / displayUrl (not the legacy `file`
 * field that lives on the fixed-recap RecapFile). The caller opens
 * `url ?? displayUrl` to download the freshly generated PDF.
 */
export const GenerateCustomRecapPdfMutation = graphql`
  mutation GenerateCustomRecapPdfMutation(
    $input: GenerateCustomRecapPdfInput!
  ) {
    generateCustomRecapPdf(input: $input) {
      success
      message
      clientMutationId
      customRecapFile {
        id
        uuid
        name
        url
        displayUrl
        createdAt
      }
    }
  }
`;
