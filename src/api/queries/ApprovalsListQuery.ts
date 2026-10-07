import { graphql } from "react-relay";

/**
 * Slim Approvals queue — only columns ApprovalsInner needs.
 * Pair with statusSlug / statusSlugs filters server-side.
 */
export const ApprovalsListQuery = graphql`
  query ApprovalsListQuery(
    $first: Int
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, filters: $filters) {
      edges {
        node {
          id
          uuid
          name
          date
          createdAt
          updatedAt
          status {
            id
            name
            slug
          }
          market
          location {
            id
            name
          }
          state {
            id
            code
          }
          retailer {
            id
            name
            location {
              id
              name
              state {
                id
                code
              }
            }
          }
          client {
            id
            name
          }
          distributor {
            id
            name
          }
          requestType {
            id
            name
          }
        }
      }
    }
  }
`;
