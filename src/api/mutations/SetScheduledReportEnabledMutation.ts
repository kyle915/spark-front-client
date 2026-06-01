import { graphql } from "react-relay";

/**
 * Toggle the automated monthly client-report schedule for a tenant.
 *
 * When enabled, this client receives an automated monthly performance
 * report (PDF) emailed to the tenant's `recapRecipientEmails` on the
 * 1st of each month, covering the prior complete month.
 *
 * Returns the resolved `enabled` flag so the toggle can reflect the
 * server's source-of-truth state.
 */
export const SetScheduledReportEnabledMutation = graphql`
  mutation SetScheduledReportEnabledMutation(
    $input: SetScheduledReportEnabledInput!
  ) {
    setScheduledReportEnabled(input: $input) {
      success
      message
      enabled
    }
  }
`;
