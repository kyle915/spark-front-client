import { graphql } from "react-relay";

/**
 * Every tenant the viewer can switch to, for the sidebar picker.
 *
 * `first: 100` is REQUIRED, not a nicety. The resolver's connection defaults
 * to `default_limit=10`, so omitting it silently returned the first 10 of 15
 * clients — the newest ones simply never reached the browser, and a client
 * created minutes earlier looked like it had failed to save. 100 is the
 * resolver's `max_limit`; past that this needs real pagination or a search
 * box, not a bigger number.
 */
export const TenantQuery = graphql`
  query TenantQuery($userUuid: ID, $filters: TenantFiltersInput) {
    tenants(userUuid: $userUuid, filters: $filters, first: 100) {
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
          id
          uuid
          name
          requestUrlName
          tenantSlug: slug
          checkinCode
          image
        }
      }
    }
  }
`;
