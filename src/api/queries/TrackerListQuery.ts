import { graphql } from "react-relay";

/**
 * Slim Master Tracker row page.
 *
 * Only the columns mapNodeToRow / CSV export need — not the fat
 * RequestsQuery tree (client, distributor, coordinates, timestamps).
 */
export const TrackerListQuery = graphql`
  query TrackerListQuery(
    $first: Int
    $after: String
    $q: String
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, after: $after, q: $q, filters: $filters) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          uuid
          name
          date
          startTime
          endTime
          address
          schedulingStatus
          isNonActiveProductRequired
          location {
            id
            name
          }
          state {
            id
            code
          }
          retailer {
            id
            name
            location {
              id
              name
              state {
                id
                code
              }
            }
          }
          requestType {
            id
            name
          }
          productNames
          openShiftsOpen
          openShiftsTotal
          openShiftsTooltip
          status {
            id
            name
            slug
          }
          event {
            id
            uuid
            date
            assignedAmbassadorsCount
            confirmedAmbassadorsCount
          }
          recapsFiledCount
          recapEventUuid
          eventsCount
        }
      }
    }
  }
`;
