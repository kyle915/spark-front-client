import { graphql } from "react-relay";

export const AmbassadorsListQuery = graphql`
  query AmbassadorsListQuery(
    $filters: AmbassadorFiltersInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    ambassadors(
      filters: $filters
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        cursor
        node {
          id
          uuid
          rating
          address
          isActive
          college
          inCollege
          headshotUrl
          user {
            firstName
            lastName
            email
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
