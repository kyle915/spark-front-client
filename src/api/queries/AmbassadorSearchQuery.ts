import { graphql } from "react-relay";

/**
 * Type-ahead search for the recap "Filling for a BA" picker.
 *
 * Hits the `activeAmbassadors` resolver which is tenant-scoped via
 * auth context — admin only sees BAs in their current tenant. The
 * `q` arg searches across name + email at the resolver layer; we
 * lazy-load with a small first limit because the autocomplete only
 * shows the top matches under the input.
 */
export const AmbassadorSearchQuery = graphql`
  query AmbassadorSearchQuery($q: String!, $first: Int!) {
    activeAmbassadors(q: $q, first: $first) {
      edges {
        node {
          id
          uuid
          user {
            id
            firstName
            lastName
            email
          }
        }
      }
    }
  }
`;
