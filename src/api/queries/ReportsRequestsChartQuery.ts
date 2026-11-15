import { graphql } from "react-relay";

/**
 * Slim request rows for Reports charts only.
 *
 * Intentionally NOT RequestsQuery — Master Tracker pulls nested
 * catalog / shift / location trees this page never renders. Charts
 * only need createdAt + requestType.name for weekly volume and mix.
 * `totalCount` is how many requests match in all, so the page can say so
 * when a page of 2,000 is not everything.
 */
export const ReportsRequestsChartQuery = graphql`
  query ReportsRequestsChartQuery($first: Int, $filters: RequestFiltersInput) {
    requests(first: $first, filters: $filters) {
      totalCount
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
