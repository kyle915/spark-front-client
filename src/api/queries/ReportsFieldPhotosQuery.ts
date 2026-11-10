import { graphql } from "react-relay";

/**
 * A small page of approved recaps in a date range, for the Reports page's
 * "From the field" photo section. Deliberately slim — one hero image per
 * recap — so it never touches the fat recap list payload.
 */
export const ReportsFieldPhotosQuery = graphql`
  query ReportsFieldPhotosQuery($first: Int, $filters: CustomRecapFiltersInput) {
    customRecaps(first: $first, filters: $filters) {
      edges {
        node {
          id
          uuid
          eventDate
          eventRetailer
          eventState
          heroImageUrl
        }
      }
    }
  }
`;
