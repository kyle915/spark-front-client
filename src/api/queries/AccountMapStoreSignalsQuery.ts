import { graphql } from "react-relay";

/**
 * Deferred store-level field intelligence (OOS alerts, buyer reorder leads,
 * manager contacts, competitor promos). Kept separate from AccountMapQuery so
 * primary map pin rendering stays skinny and rolling deploys degrade gracefully.
 */
export const AccountMapStoreSignalsQuery = graphql`
  query AccountMapStoreSignalsQuery($tenantId: ID) {
    accountMapStoreSignals(tenantId: $tenantId) {
      recapUuid
      storeKey
      storeName
      address
      city
      stateCode
      eventDate
      stockoutRisk
      reorderOpportunity
      managerContact
      managerNote
      competitorBrand
      competitorPromo
      rmmEmail
      distributorName
    }
  }
`;
