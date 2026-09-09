import { graphql } from "react-relay";

/**
 * Slim classic + custom recap rows for Reports engagement charts.
 *
 * KPI tiles already fold custom-recap consumers into eventDashboard;
 * these charts previously only queried classic RecapsQuery, so Torch /
 * Girl Beer / etc. showed empty while the strip above had real numbers.
 * Prefer consumersSampled on custom rows (field-parsed); fall back to
 * totalEngagements on both kinds.
 */
export const ReportsEngagementsChartQuery = graphql`
  query ReportsEngagementsChartQuery(
    $first: Int
    $filters: RecapFiltersInput
    $customFilters: CustomRecapFiltersInput
  ) {
    recaps(first: $first, filters: $filters) {
      edges {
        node {
          id
          createdAt
          eventDate
          eventRetailer
          totalEngagements
          # Same source the eventDashboard Consumers tile uses for
          # classic recaps (not Recap.totalEngagements alone).
          consumerEngagements {
            totalConsumer
          }
        }
      }
    }
    customRecaps(first: $first, filters: $customFilters) {
      edges {
        node {
          id
          createdAt
          eventDate
          eventRetailer
          totalEngagements
          consumersSampled
        }
      }
    }
  }
`;
