import { graphql } from "react-relay";

// Slim card query for /recaps/list. Keep this to scalars + heroFile.file —
// do not restore per-row file/field arrays here (that payload is what made
// the client list hang, then render empty). Detail views have their own
// queries. Pagination is `first` (50, then more), same as admin.
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
        }
      }
    }
  }
`;
