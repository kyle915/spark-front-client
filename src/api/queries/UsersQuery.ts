import { graphql } from "react-relay";

export const UsersQuery = graphql`
  query UsersQuery(
    $filters: UserFiltersInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    users(
      filters: $filters
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        cursor
        node {
          __typename
          id
          uuid
          firstName
          lastName
          email
          image
          role {
            __typename
            id
            uuid
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
