import { graphql } from "react-relay";

/**
 * Latest GPS ping per Ambassador within the last N minutes, scoped to
 * the current tenant. Backend collapses to one row per BA so the map
 * shows current location, not a trail.
 *
 * Powers the "Today, on the ground" admin/client map.
 * tenantId is REQUIRED for correct scoping — omitting it made admins
 * filter event__tenant_id=NULL and always see an empty map.
 */
export const RecentLocationPingsQuery = graphql`
  query RecentLocationPingsQuery(
    $withinMinutes: Int = 120
    $tenantId: ID
  ) {
    recentLocationPings(withinMinutes: $withinMinutes, tenantId: $tenantId) {
      uuid
      lat
      lng
      accuracyMeters
      recordedAt
      source
      ambassadorUuid
      ambassadorName
      eventUuid
      eventName
    }
  }
`;
