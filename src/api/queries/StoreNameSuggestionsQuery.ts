import { graphql } from "react-relay";

/**
 * Store names that look like the same store written differently, waiting for
 * staff, plus the ones already combined. Staff only: a brand user is refused.
 * `affectedRecords` is how many records would be shown under the other name.
 */
export const StoreNameSuggestionsQuery = graphql`
  query StoreNameSuggestionsQuery($tenantId: ID!) {
    storeNameSuggestions(tenantId: $tenantId) {
      maxGroupSize
      groups {
        groupKey
        canonicalName
        kind
        source
        reason
        canonicalRecords
        affectedRecords
        names {
          uuid
          name
          records
          places
        }
      }
      accepted {
        uuid
        name
        canonicalName
        records
      }
    }
  }
`;
