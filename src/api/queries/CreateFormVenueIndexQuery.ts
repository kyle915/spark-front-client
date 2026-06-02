import { graphql } from "react-relay";

/**
 * Narrow query powering the Create Request venue type-ahead.
 *
 * The Express form suggests repeat venues from prior requests. The index
 * it builds only needs the venue name, address, date, and the
 * distributor / request-type ids to carry forward — NOT the full Request
 * payload (status, events, recaps, coordinates, retailer location tree,
 * …) that `RequestsQuery` ships. Pulling those heavy fields for hundreds
 * of rows was the bulk of the "Loading form…" wait.
 *
 * Kept deliberately tiny so it stays cheap even as the request count
 * grows, and it's fetched in its own Suspense boundary so the form's core
 * fields paint without waiting on it.
 */
export const CreateFormVenueIndexQuery = graphql`
  query CreateFormVenueIndexQuery(
    $first: Int
    $filters: RequestFiltersInput
  ) {
    requests(first: $first, filters: $filters) {
      edges {
        node {
          id
          name
          date
          address
          distributor {
            id
          }
          requestType {
            id
          }
          retailer {
            id
            name
          }
        }
      }
    }
  }
`;
