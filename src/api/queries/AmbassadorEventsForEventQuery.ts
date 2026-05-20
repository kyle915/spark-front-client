import { graphql } from "react-relay";

/**
 * All AmbassadorEvent rows for a single Event — the "roster" of
 * invited and accepted BAs. Powers the Roster panel on
 * /request/view.
 *
 * Backend `ambassadorEvents` connection is paginated, but per-event
 * rosters are small (typically <20), so we ask for `first: 200`
 * once and render the result without a load-more.
 */
export const AmbassadorEventsForEventQuery = graphql`
  query AmbassadorEventsForEventQuery($eventId: ID!) {
    ambassadorEvents(first: 200, filters: { eventId: $eventId }) {
      edges {
        node {
          id
          uuid
          isApproved
          createdAt
          ambassador {
            id
            uuid
            user {
              id
              email
              firstName
              lastName
            }
            address
            isActive
          }
        }
      }
    }
  }
`;
