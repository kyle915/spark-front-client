import { graphql } from "react-relay";

/**
 * Client Today week-ahead list + honest completion rollup.
 *
 * Intentionally NOT RequestsQuery — Master Tracker pulls products,
 * openShifts, nested location trees, etc. Week-ahead only needs date +
 * retailer name for today→+7d. Completion % comes from
 * ``clientTodayCompletion`` scalars (filed / scheduled), not a capped
 * 90d request list.
 */
export const ClientWeekAheadQuery = graphql`
  query ClientWeekAheadQuery(
    $first: Int
    $filters: RequestFiltersInput
    $tenantId: ID!
    $lookbackDays: Int
  ) {
    requests(first: $first, filters: $filters) {
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
    }
    clientTodayCompletion(tenantId: $tenantId, lookbackDays: $lookbackDays) {
      scheduled
      filed
      startDate
      endDate
      lookbackDays
    }
  }
`;
