import { graphql } from "react-relay";

/**
 * Email the campaign-report PDF to a list of recipients.
 *
 * Same recap selection + caps as GenerateCampaignReportPdfMutation,
 * but instead of returning a download URL the backend ships the PDF
 * as an email attachment via Resend.
 */
export const EmailCampaignReportMutation = graphql`
  mutation EmailCampaignReportMutation($input: EmailCampaignReportInput!) {
    emailCampaignReport(input: $input) {
      success
      message
    }
  }
`;
