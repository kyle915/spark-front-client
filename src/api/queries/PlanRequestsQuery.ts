import { graphql } from "react-relay";

/**
 * Slim request rows for a single Activation Plan detail page.
 */
export const PlanRequestsQuery = graphql`
  query PlanRequestsQuery(
    $first: Int
    $q: String
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, q: $q, filters: $filters) {
      edges {
        node {
          id
          uuid
          name
          date
          address
          status {
            id
            name
            slug
          }
          retailer {
            id
            name
          }
          location {
            id
            name
          }
          state {
            id
            code
          }
          requestType {
            id
            name
          }
          event {
            id
            date
            assignedAmbassadorsCount
            confirmedAmbassadorsCount
          }
          recapsFiledCount
        }
      }
    }
  }
`;
