import { graphql } from "react-relay";

/**
 * Lightweight requests query for the sidebar badge counts ONLY.
 *
 * The sidebar is mounted on every page, and it used to run the full fat
 * RequestsQuery with first:1000 just to tally a handful of integer badges —
 * pulling ~1,000 rows × deeply-nested event/retailer/client/products/openShifts
 * objects on every navigation, which blocked the main thread (the app felt
 * unclickable). useSidebarCounts only needs status + a few dates + the recap
 * scalars, so this selects exactly those and nothing else. Orders of magnitude
 * less JSON to transfer and normalize into the Relay store.
 */
export const SidebarCountsQuery = graphql`
  query SidebarCountsQuery($first: Int, $filters: RequestFiltersInput) {
    requests(first: $first, filters: $filters) {
      edges {
        node {
          id
          date
          createdAt
          updatedAt
          recapsFiledCount
          eventsCount
          status {
            id
            slug
            name
          }
        }
      }
    }
  }
`;
