import { graphql } from "react-relay";

/**
 * Ambassadors waiting for admin approval — newest first.
 *
 * Hits the `pendingAmbassadors` resolver on
 * AmbassadorManagementQueries (IsClientOrSparkAdmin permission).
 * Filters to is_active=False profiles whose user is still active,
 * so we don't surface old soft-deleted users.
 *
 * Used by /people/pending to render the approval queue.
 */
export const PendingAmbassadorsQuery = graphql`
  query PendingAmbassadorsQuery($first: Int, $after: String) {
    pendingAmbassadors(first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          uuid
          phone
          createdAt
          user {
            id
            uuid
            email
            firstName
            lastName
          }
        }
      }
    }
  }
`;
