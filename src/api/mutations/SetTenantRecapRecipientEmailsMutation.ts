import { graphql } from "react-relay";

/**
 * Persist the extra recap-approval email recipients on the tenant
 * record. These addresses receive the recap-APPROVAL email for the
 * brand in addition to the RMM, client-role users, and the requestor.
 *
 * `emails` is the raw stored string (comma- or newline-separated);
 * passing "" clears the list. Returns the updated tenant so Relay can
 * patch the cached `recapRecipientEmails` in place.
 */
export const SetTenantRecapRecipientEmailsMutation = graphql`
  mutation SetTenantRecapRecipientEmailsMutation($tenantId: ID!, $emails: String!) {
    setTenantRecapRecipientEmails(tenantId: $tenantId, emails: $emails) {
      id
      uuid
      recapRecipientEmails
    }
  }
`;
