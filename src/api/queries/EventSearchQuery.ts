import { graphql } from "react-relay";

/**
 * Lightweight event lookup for Jump.
 *
 * `events(q:)` is a case-insensitive contains match on the event name
 * (the existing search argument — EventFiltersInput has no name field).
 * Address deepens the hint so store-ish queries still feel findable.
 */
export const EventSearchQuery = graphql`
  query EventSearchQuery($q: String, $first: Int) {
    events(q: $q, first: $first) {
      edges {
        node {
          uuid
          name
          date
          address
          request {
            retailer {
              name
            }
          }
        }
      }
    }
  }
`;
