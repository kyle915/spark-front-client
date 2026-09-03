import { graphql } from "react-relay";

/**
 * Cheap totalCount probe so SparkRecapsList can skip the unused
 * legacy or custom page-1 query (don't always pay 50+50).
 */
export const RecapListKindsProbeQuery = graphql`
  query RecapListKindsProbeQuery(
    $q: String
    $legacyFilters: RecapFiltersInput
    $customFilters: CustomRecapFiltersInput
  ) {
    recaps(first: 1, q: $q, filters: $legacyFilters) {
      totalCount
    }
    customRecaps(first: 1, q: $q, filters: $customFilters) {
      totalCount
    }
  }
`;
