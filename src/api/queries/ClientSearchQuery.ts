import { graphql } from "react-relay";

/**
 * Lightweight client lookup for Jump.
 *
 * `clients(q:)` is a case-insensitive contains match on the client name.
 * Detail lives at `/clients/:tenantId`.
 */
export const ClientSearchQuery = graphql`
  query ClientSearchQuery($q: String, $filters: ClientFiltersInput!, $first: Int) {
    clients(q: $q, filters: $filters, first: $first) {
      edges {
        node {
          uuid
          name
          email
          tenantId
        }
      }
    }
  }
`;
