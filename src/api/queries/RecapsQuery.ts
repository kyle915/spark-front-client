import { graphql } from "react-relay";

// Shared legacy connection used by RecapsList table / reports.
// SparkRecapsList + client approvals use RecapsListQuery (same slim
// selection, dedicated operation + store-and-network). Keep this to
// scalars + heroFile.file — do not restore per-row file/field arrays.
// Detail views have their own queries.
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
          approvedAt
          approvedBy {
            firstName
            lastName
            email
          }
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
