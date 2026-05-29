import { graphql } from "react-relay";

/**
 * BA roster for the recap "FILLING FOR A BA?" picker.
 *
 * Repoints the picker off `activeAmbassadors` / `ambassadors`, which scope
 * BAs by TenantedUser membership. BAs are linked to a brand by their worked
 * events, not a TenantedUser row, so those queries returned nothing — the
 * picker showed "NO MATCHES" for every real name. This uses
 * `chatRecipientAmbassadors` (the SAME resolver that fixed the chat
 * composer's "No ambassadors found"), which scopes by AmbassadorEvent
 * history in the active tenant, so the picker lists exactly the tenant's
 * BAs. `q` filters by name/email server-side; `tenantId` carries the
 * dashboard's selected tenant (empty → backend returns []).
 *
 * `id` is the Ambassador's Relay global id — the createRecap /
 * createCustomRecap mutations run `ambassadorId` through resolve_id_to_int,
 * which accepts global ids or digit strings but NOT raw uuids, so we select
 * `id` (not just uuid) and hand it to the mutation.
 */
export const RecapBaRosterQuery = graphql`
  query RecapBaRosterQuery($tenantId: ID, $q: String) {
    chatRecipientAmbassadors(tenantId: $tenantId, q: $q) {
      id
      uuid
      name
      email
    }
  }
`;
