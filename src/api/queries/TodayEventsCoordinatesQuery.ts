import { graphql } from "react-relay";

export const TodayEventsCoordinatesQuery = graphql`
  query TodayEventsCoordinatesQuery(
    $coordinates: [Float!]!
    $range: Float!
    $unit: DistanceUnit!
    $filters: EventFiltersInput!
  ) {
    todayEventsCoordinates(
      coordinates: $coordinates
      range: $range
      unit: $unit
      filters: $filters
    ) {
      edges {
        node {
          id
          uuid
          name
          startTime
          endTime
          address
          request {
            coordinates
          }
          eventType {
            name
          }
          status {
            name
          }
        }
      }
    }
  }
`;
