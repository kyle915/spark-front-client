import { graphql } from "react-relay";

/**
 * Send a one-off TEST monthly client report to the requesting user only.
 *
 * This is a safe preview: the email goes ONLY to the signed-in user who
 * triggers it, never to the client / recap recipients. Defaults to the
 * prior complete month when `month` is omitted.
 */
export const SendTestClientReportMutation = graphql`
  mutation SendTestClientReportMutation($input: SendTestClientReportInput!) {
    sendTestClientReport(input: $input) {
      success
      message
    }
  }
`;
