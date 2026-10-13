import { graphql } from "react-relay";

/**
 * Slim card-row query for SparkRecapsList / client approvals.
 *
 * Server-side aggregates (soldUnits, consumersSampled, heroImageUrl,
 * customRecapFilesCount, accountSpend, baDisplayName) replace per-row
 * product/file/field arrays. Nested event objects are intentionally
 * omitted — use eventDate / eventRetailer / eventState scalars instead.
 * Detail still uses CustomRecapsQueryDetailsQuery.
 */
export const CustomRecapsListQuery = graphql`
  query CustomRecapsListQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: CustomRecapFiltersInput
    $q: String
  ) {
    customRecaps(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
      q: $q
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
          createdAt
          totalEngagements
          approved
          approvedAt
          approvedBy {
            firstName
            lastName
            email
          }
          isThirdParty
          excludeFromAggregates
          sourceLabel
          coActivation {
            brandNames
          }
          storeMappingStatus
          shareToken
          sharedAt
          archivedAt
          eventDate
          eventAddress
          eventRetailer
          eventState
          ambassador {
            id
            user {
              firstName
              lastName
            }
          }
          customRecapTemplate {
            id
            name
          }
          recapType
          soldUnits
          consumersSampled
          isDryDemo
          peopleEngaged
          heroImageUrl
          customRecapFilesCount
          accountSpend
          baDisplayName
        }
      }
    }
  }
`;
