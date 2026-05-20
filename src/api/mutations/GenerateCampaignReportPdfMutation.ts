import { graphql } from "react-relay";

/**
 * Bundle N recaps into one PDF deliverable.
 *
 * Returns the public GCS URL of the rendered file. The caller opens it
 * in a new tab the same way the per-recap PDF works. The PDF includes
 * a campaign cover page (aggregated consumer numbers + date range)
 * followed by one detail page per recap, in the order passed.
 *
 * Backend caps the export at 50 recaps to keep render time well under
 * Cloud Run's 60s request budget — the front-end mirrors that ceiling
 * with a disabled button + a friendly message when the user multi-
 * selects more.
 */
export const GenerateCampaignReportPdfMutation = graphql`
  mutation GenerateCampaignReportPdfMutation(
    $input: GenerateCampaignReportPdfInput!
  ) {
    generateCampaignReportPdf(input: $input) {
      success
      message
      fileUrl
    }
  }
`;
