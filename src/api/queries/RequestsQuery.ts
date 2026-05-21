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
          status {
            __typename
            id
            uuid
            name
            slug
          }
          # Mapped reviewer — set after state-based RMM routing for
          # Liquid Death. Powers the Approvals page user filter so
          # admins can slice "show me requests assigned to <user>".
          rmmAsigned {
            id
            uuid
            firstName
            lastName
            email
          }
          event {
            __typename
            id
            uuid
            name
          }
          # Used by the sidebar recap-due badge + the Master Tracker
          # RECAP chip. Includes both standard recaps and tenant-custom
          # recaps (Borjomi, etc.) so the chip reflects either path.
          # Just IDs — no fields beyond id — to keep payload tiny.
          events {
            id
            recaps {
              id
            }
            customRecaps {
              id
            }
          }
          tenantId
          createdAt
          updatedAt
        }
      }
    }
  }
`;
