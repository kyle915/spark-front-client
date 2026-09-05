import { graphql } from "react-relay";

/** Insights Timeline — recentEvents only (server sections short-circuit). */
export const EventDashboardTimelineQuery = graphql`
  query EventDashboardTimelineQuery($filters: EventDashboardFiltersInput) {
    eventDashboard(filters: $filters) {
      recentEvents {
        id
        name
        date
        location
        consumers
        intentRate
        status
      }
    }
  }
`;
