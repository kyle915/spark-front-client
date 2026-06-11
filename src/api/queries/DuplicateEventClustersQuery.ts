import { graphql } from "react-relay";

/**
 * Admin cleanup tool: same-name events on the same/adjacent dates for
 * the active tenant — the bulk-upload double-run signature. Each row
 * carries recap/roster counts so picking the keeper is obvious.
 */
export const DuplicateEventClustersQuery = graphql`
  query DuplicateEventClustersQuery($tenantId: ID!) {
    duplicateEventClusters(tenantId: $tenantId) {
      key
      events {
        id
        uuid
        name
        date
        address
        recapsFiled
        rosterCount
      }
    }
  }
`;
