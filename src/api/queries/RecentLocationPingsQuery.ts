import { graphql } from "react-relay";

/**
 * Latest GPS ping per Ambassador within the last N minutes, scoped to
 * the current tenant. Backend collapses to one row per BA so the map
 * shows current location, not a trail.
 *
 * Powers the "Today, on the ground" admin map.
 */
export const RecentLocationPingsQuery = graphql`
  query RecentLocationPingsQuery($withinMinutes: Int = 30) {
    recentLocationPings(withinMinutes: $withinMinutes) {
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
