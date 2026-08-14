import { graphql } from "react-relay";

export const RecapsQuery = graphql`
  query RecapsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $q: String
    $filters: RecapFiltersInput
  ) {
    recaps(
      first: $first
      after: $after
      last: $last
      before: $before
      q: $q
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
          approved
          shareToken
          sharedAt
          createdAt
          submittedAt
          totalEngagements
          productsSold
          totalCansSold
          totalPacksSold
          accountSpendAmount
          externalBaName
          recapFilesCount
          heroFile {
            file
          }
          eventDate
          eventRetailer
          eventState
          requestUuid
          requestTypeName
          ambassador {
            id
            user {
              firstName
              lastName
            }
          }
          event {
            name
            date
          }
        }
      }
    }
  }
`;
