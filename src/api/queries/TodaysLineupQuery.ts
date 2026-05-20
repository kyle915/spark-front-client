import { graphql } from "react-relay";

/**
 * Today's lineup — every event scheduled for "today" in the active
 * tenant, with the assigned BAs and recap status. Powers the live
 * dashboard widget that tells kyle / RMMs what's happening RIGHT NOW.
 *
 * Two parallel reads we merge in JS:
 *   - `events`: source of truth for today's activations (one row each)
 *   - `ambassadorEvents`: BA assignments scoped to today
 *
 * Querying both lets us render events with zero accepted BAs (which
 * the ambassadorEvents query alone would hide) while still showing
 * BA names + accept state on the ones that have invites.
 *
 * The widget passes today's ISO date as start/end so the backend
 * date filter does the narrowing. We cap pagination at 50 — kyle
 * has never run more than ~15 activations in a single day.
 */
export const TodaysLineupQuery = graphql`
  query TodaysLineupQuery(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    events(
      first: 50
      filters: {
        tenantId: $tenantId
        startDate: $startDate
        endDate: $endDate
      }
    ) {
      edges {
        node {
          id
          uuid
          name
          startTime
          endTime
          address
          retailer {
            name
          }
          status {
            slug
            name
          }
          recaps {
            uuid
          }
        }
      }
    }
    ambassadorEvents(
      first: 200
      filters: {
        startDate: $startDate
        endDate: $endDate
      }
    ) {
      edges {
        node {
          uuid
          isApproved
          eventId
          ambassador {
            uuid
            user {
              firstName
              lastName
              email
            }
          }
        }
      }
    }
  }
`;
