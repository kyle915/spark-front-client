import { graphql } from "react-relay";

/** Tracker ConsumersStat — only consumersSampled, no filterOptions / trends. */
export const EventDashboardConsumersQuery = graphql`
  query EventDashboardConsumersQuery($filters: EventDashboardFiltersInput) {
    eventDashboard(filters: $filters) {
      metrics {
        consumersSampled
      }
    }
  }
`;
