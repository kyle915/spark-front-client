import { graphql } from "react-relay";

/**
 * Client dashboard week-ahead list.
 *
 * Intentionally NOT RequestsQuery — Master Tracker pulls products,
 * openShifts, nested location trees, etc. Week-ahead only needs date +
 * retailer name for today→+7d.
 */
export const ClientWeekAheadQuery = graphql`
  query ClientWeekAheadQuery(
    $first: Int
    $after: String
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, after: $after, filters: $filters) {
      edges {
        node {
          id
          date
          retailer {
            id
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
