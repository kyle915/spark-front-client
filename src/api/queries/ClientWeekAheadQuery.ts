import { graphql } from "react-relay";

/**
 * Client Today week-ahead + completion rollup.
 *
 * Intentionally NOT RequestsQuery — Master Tracker pulls products,
 * openShifts, nested location trees, etc. Client Today only needs
 * date + filed-recap scalar + retailer name for a short window.
 */
export const ClientWeekAheadQuery = graphql`
  query ClientWeekAheadQuery(
    $first: Int
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, filters: $filters) {
      edges {
        node {
          id
          date
          recapsFiledCount
          retailer {
            id
            name
          }
        }
      }
    }
  }
`;
