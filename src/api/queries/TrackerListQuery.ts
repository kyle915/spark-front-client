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
          market
          schedulingStatus
          isNonActiveProductRequired
          activationPlan {
            id
            name
          }
          retailer {
            id
            name
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
          # RMM owner for Master Tracker "By RMM" group headers.
          rmmAsigned {
            id
            firstName
            lastName
          }
          event {
            id
            uuid
            date
            startTime
            assignedAmbassadorsCount
            confirmedAmbassadorsCount
          }
          recapsFiledCount
          recapEventUuid
          eventsCount
          # True when staff dismissed every event on the request as owing
          # no recap, so the row does not show "Recap due".
          recapDismissed
        }
      }
    }
  }
`;
