import { graphql } from "react-relay";

/**
 * Home "What needs you" cards. Loaded only on the dashboard, not on
 * every admin page — the sidebar badges use SidebarCountsQuery scalars.
 */
export const HomeAttentionQuery = graphql`
  query HomeAttentionQuery(
    $first: Int
    $after: String
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, after: $after, filters: $filters) {
      edges {
        node {
          id
          date
          createdAt
          status {
            id
            slug
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
