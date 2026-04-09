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
        }
      }
    }
  }
`;
