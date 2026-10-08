import { graphql } from "react-relay";

/**
 * Slim card-row query for SparkRecapsList / client approvals.
 *
 * Only scalars + heroFile.file — never per-row file/field/sample arrays.
 * Detail views use RecapQuery / CustomRecapsQueryDetailsQuery.
 *
 * Kept as its own operation (vs RecapsQuery) so list cache entries are
 * explicit and we can assert the selection stays slim in tests.
 */
export const RecapsListQuery = graphql`
  query RecapsListQuery(
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
          archivedAt
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
          recapType
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
