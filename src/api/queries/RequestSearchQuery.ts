import { graphql } from "react-relay";

/**
 * Lightweight request lookup for the ⌘K command palette.
 *
 * `filters.name` is a case-insensitive match on the request's own name
 * OR its retailer's name (server-side), so typing "Vons" surfaces Vons
 * requests and typing a campaign title finds it directly. Selection is
 * intentionally tiny — the palette only needs a label, a hint, and the
 * uuid to deep-link `/request/view/:uuid`.
 */
export const RequestSearchQuery = graphql`
  query RequestSearchQuery($filters: RequestFiltersInput, $first: Int) {
    requests(filters: $filters, first: $first) {
      edges {
        node {
          uuid
          name
          date
          retailer {
            name
          }
        }
      }
    }
  }
`;
