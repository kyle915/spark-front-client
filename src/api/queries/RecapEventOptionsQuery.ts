import { graphql } from "react-relay";

/**
 * Events selectable when FILING A RECAP — STRICTLY tenant-scoped.
 *
 * Backs the "NEW RECAP → Tell us how it went → search events" picker.
 * Deliberately NOT the general `events` query: that one is an
 * all-tenants admin surface and returns every tenant's events for
 * Ignite staff. `recapEventOptions` is hard-scoped to the active
 * tenant on the SERVER (it returns an empty page when no tenant is in
 * scope), so the picker can never leak another client's events even if
 * the frontend forgets to pass a tenant filter — which is exactly how
 * the leak (#343 was frontend-only) came back.
 *
 * Each node carries `tenant { id name }` so every row can show its
 * client/brand label.
 */
export const RecapEventOptionsQuery = graphql`
  query RecapEventOptionsQuery(
    $tenantId: ID
    $q: String
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    recapEventOptions(
      tenantId: $tenantId
      q: $q
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          __typename
          id
          uuid
          name
          date
          startTime
          endTime
          address
          tenantId
          tenant {
            __typename
            id
            uuid
            name
          }
          request {
            __typename
            id
            uuid
            name
            date
            retailer {
              __typename
              id
              uuid
              name
            }
          }
          status {
            __typename
            id
            uuid
            name
            slug
          }
        }
      }
    }
  }
`;
