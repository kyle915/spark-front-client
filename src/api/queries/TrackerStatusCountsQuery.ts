import { graphql } from "react-relay";

/**
 * Master Tracker status chip + market dropdown totals.
 *
 * Rows page at 100 via `requests`; chip counts used to be tallied from
 * whatever pages had loaded (wrong past page 1, and zero for statuses
 * filtered out server-side). This query ignores status chip filters so
 * every bucket stays accurate, and ignores stateCode for marketCodes so
 * the Market dropdown stays complete.
 */
export const TrackerStatusCountsQuery = graphql`
  query TrackerStatusCountsQuery($filters: RequestFiltersInput, $q: String) {
    trackerStatusCounts(filters: $filters, q: $q) {
      total
      buckets {
        slug
        count
      }
      marketCodes
    }
  }
`;
