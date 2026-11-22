import { graphql } from "react-relay";

/**
 * Composite-ranked BA shortlist with transparent scoring reasons (SPA-38).
 * Prefer over legacy ``staffingSuggestions`` when the API surface is live.
 */
export const SmartBaMatchesQuery = graphql`
  query SmartBaMatchesQuery(
    $eventId: ID
    $storeKey: String
    $tenantId: ID
    $limit: Int
  ) {
    smartBaMatches(
      eventId: $eventId
      storeKey: $storeKey
      tenantId: $tenantId
      limit: $limit
    ) {
      baId
      baUuid
      name
      score
      unitsPerHour
      reliabilityRate
      brandCertified
      brandGigs
      distanceMiles
      isAvailable
      isFavorited
      email
      phone
      reasons
      summaryReason
    }
  }
`;