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
          location {
            id
            uuid
            name
          }
          state {
            id
            uuid
            name
            code
          }
          event {
            id
            uuid
            name
            address
            date
            location {
              id
              uuid
              name
            }
            state {
              id
              uuid
              name
              code
            }
            startTime
            timezone {
              id
              name
              code
              offset
            }
            retailer {
              id
              uuid
              name
              location {
                id
                uuid
                name
                state {
                  id
                  uuid
                  name
                  code
                }
              }
            }
            distributor {
              id
              uuid
              name
              location {
                id
                uuid
                name
                state {
                  id
                  uuid
                  name
                  code
                }
              }
            }
            request {
              id
              uuid
              # Event Activation / Retail Sampling / etc. Nevena needs
              # this on the recap list + CSV export so client reports
              # can group recaps by request type.
              requestType {
                id
                uuid
                name
              }
              location {
                id
                uuid
                name
              }
              state {
                id
                uuid
                name
                code
              }
              retailer {
                id
                uuid
                name
                location {
                  id
                  uuid
                  name
                  state {
                    id
                    uuid
                    name
                    code
                  }
                }
              }
              distributor {
                id
                uuid
                name
                location {
                  id
                  uuid
                  name
                  state {
                    id
                    uuid
                    name
                    code
                  }
                }
              }
            }
          }
          approved
          createdAt
          totalEngagements
          productsSold
          totalCansSold
          totalPacksSold
          accountSpendAmount
          externalBaName
          ambassador {
            id
            uuid
            user {
              id
              firstName
              lastName
            }
          }
          # List view only needs the count + one renderable photo.
          # Server-side resolvers cap the work — recapFilesCount runs
          # a single COUNT(*), heroFile returns the first image-typed
          # row. Trimming the full recapFiles array shrinks the
          # response by 5–20× depending on how many photos per recap.
          recapFilesCount
          heroFile {
            id
            file
            fileType {
              id
              name
              extension
            }
          }
        }
      }
    }
  }
`;
