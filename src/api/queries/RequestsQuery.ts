import { graphql } from "react-relay";

export const RequestsQuery = graphql`
  query RequestsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $q: String
    $filters: RequestFiltersInput
  ) {
    requests(
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
          __typename
          id
          uuid
          name
          date
          startTime
          endTime
          address
          coordinates
          schedulingStatus
          location {
            id
            name
          }
          state {
            id
            name
            code
          }
          client {
            __typename
            id
            uuid
            name
          }
          distributor {
            __typename
            id
            uuid
            name
          }
          retailer {
            __typename
            id
            uuid
            name
            location {
              id
              name
              state {
                id
                name
                code
              }
            }
          }
          requestType {
            __typename
            id
            uuid
            name
          }
          # Selected SKUs/products on the request — shown as a compact
          # cell on the Master Tracker. Prefetched server-side
          # (request_product__product), so no N+1 across the table.
          products {
            id
            name
          }
          # Shift-swap activity: dropped slots that reopened for self-serve
          # claim. Powers the Master Tracker "needs coverage" chip + tooltip.
          # Prefetched server-side (event_set__open_shifts), so no N+1.
          openShifts {
            uuid
            eventName
            releasedByName
            claimedByName
            status
          }
          status {
            __typename
            id
            uuid
            name
            slug
          }
          event {
            __typename
            id
            uuid
            name
            assignedAmbassadorsCount
            confirmedAmbassadorsCount
          }
          # Recap rollups for the Master Tracker RECAP chip + the sidebar
          # recap-due badge, as flat server-computed scalars instead of the
          # full per-event recaps/customRecaps arrays — keeps the per-row
          # payload tiny for big tenants. recapEventUuid points a "N RECAP"
          # click at the event that actually holds a recap; eventsCount
          # distinguishes "no events" from "events but no recap yet".
          recapsFiledCount
          recapEventUuid
          eventsCount
          tenantId
          createdAt
          updatedAt
        }
      }
    }
  }
`;
