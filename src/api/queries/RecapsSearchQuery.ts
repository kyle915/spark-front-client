import { graphql } from "react-relay";

/**
 * Lightweight recap lookup for the ⌘K command palette — searches BOTH
 * recap families (legacy fixed-form `recaps` and per-tenant
 * `customRecaps`) by name in one round trip. `q` is a case-insensitive
 * name match server-side. Selection is palette-sized: a label, the
 * approval state + event date for the hint line, and the uuid to
 * deep-link the right viewer (/recap/view vs /recap/view-custom).
 */
export const RecapsSearchQuery = graphql`
  query RecapsSearchQuery($q: String, $first: Int) {
    recaps(q: $q, first: $first) {
      edges {
        node {
          uuid
          name
          approved
          event {
            date
          }
        }
      }
    }
    customRecaps(q: $q, first: $first) {
      edges {
        node {
          uuid
          name
          approved
          event {
            date
          }
        }
      }
    }
  }
`;
