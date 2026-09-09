import { graphql } from "react-relay";

/**
 * Slim request rows for Reports charts only.
 *
 * Intentionally NOT RequestsQuery — Master Tracker pulls nested
 * catalog / shift / location trees this page never renders. Charts
 * only need createdAt + requestType.name for weekly volume and mix.
 */
export const ReportsRequestsChartQuery = graphql`
  query ReportsRequestsChartQuery($first: Int, $filters: RequestFiltersInput) {
    requests(first: $first, filters: $filters) {
      edges {
        node {
          id
          createdAt
          requestType {
            id
            name
          }
        }
      }
    }
  }
`;
