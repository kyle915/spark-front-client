import { graphql } from "react-relay";

/**
 * Recaps list type chips: the tenant's recap types (Retail / On-Premise /
 * Event / Guerilla / Seeding) with counts under the list's other filters.
 */
export const RecapTypeCountsQuery = graphql`
  query RecapTypeCountsQuery($q: String, $filters: CustomRecapFiltersInput) {
    recapTypeCounts(q: $q, filters: $filters) {
      total
      types {
        key
        label
        count
      }
    }
  }
`;
