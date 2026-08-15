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
          createdAt
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
          # shareToken / sharedAt / submittedAt / eventDate / eventRetailer /
          # eventState / requestUuid / requestTypeName land with API PR 915.
          # Selecting them against today's Cloud Run Recap type 500s the
          # whole /recaps page (GraphQL rejects unknown fields).
          retailer {
            name
          }
          state {
            name
            code
          }
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
            address
            retailer {
              name
            }
            request {
              retailer {
                name
              }
            }
          }
        }
      }
    }
  }
`;
