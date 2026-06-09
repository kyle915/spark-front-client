import { graphql } from "react-relay";

/**
 * Toggle the weekly client digest for a tenant.
 *
 * When enabled, this client receives the weekly field-marketing digest
 * email (this week at a glance / coming up / needs your approval),
 * sent to the tenant's `recapRecipientEmails` every Monday. Its own
 * flag — independent from the monthly report toggle — so each rolls
 * out per tenant separately.
 *
 * Returns the resolved `enabled` flag so the toggle can reflect the
 * server's source-of-truth state.
 */
export const SetClientWeeklyDigestEnabledMutation = graphql`
  mutation SetClientWeeklyDigestEnabledMutation(
    $input: SetClientWeeklyDigestEnabledInput!
  ) {
    setClientWeeklyDigestEnabled(input: $input) {
      success
      message
      enabled
    }
  }
`;
