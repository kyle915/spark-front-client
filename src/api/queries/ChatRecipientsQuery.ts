import { graphql } from "react-relay";

/**
 * Recipient picker source for the broadcast composer: the active
 * tenant's BAs AND ambassador groups in one round-trip.
 *
 * Ambassadors come from `chatRecipientAmbassadors`, NOT the generic
 * `ambassadors` query. The generic query scopes BAs by TenantedUser
 * membership — BAs are linked to a brand by their worked events, not a
 * TenantedUser row, so it returned nothing ("No ambassadors found").
 * `chatRecipientAmbassadors` scopes by event history in the tenant — the
 * SAME reachability rule broadcastChatMessage enforces — so the picker
 * lists exactly the BAs a broadcast can actually reach. It also takes a
 * server-side `q` search term (name/email). Groups stay tenant-scoped via
 * filters.tenantId.
 */
export const ChatRecipientsQuery = graphql`
  query ChatRecipientsQuery(
    $tenantId: ID
    $q: String
    $groupFilters: AmbassadorGroupFiltersInput
  ) {
    chatRecipientAmbassadors(tenantId: $tenantId, q: $q) {
      uuid
      name
      email
    }
    ambassadorGroups(filters: $groupFilters, first: 200) {
      edges {
        node {
          id
          uuid
          name
          members {
            id
          }
        }
      }
    }
  }
`;
