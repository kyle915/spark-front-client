import { graphql } from "react-relay";

export const RecapsQuery = graphql`
  query RecapsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: RecapFiltersInput
  ) {
    recaps(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
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
          id
          uuid
          name
          eventId
          event {
            id
            uuid
            name
            date
            startTime
            timezone {
              id
              name
              code
              offset
            }
          }
          approved
          createdAt
        }
      }
    }
  }
`;
