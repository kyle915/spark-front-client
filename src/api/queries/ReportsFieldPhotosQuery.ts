import { graphql } from "react-relay";

/**
 * A small page of approved recaps in a date range, for the Reports page's
 * "From the field" photo section. Deliberately slim — the recap's files with their
 * category — so it never touches the fat recap list payload.
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
          # Files with their category so receipts / product-spend photos can
          # be excluded client-side (heroImageUrl is just the first file).
          customRecapFiles {
            url
            displayUrl
            fileType {
              name
            }
            fileRecapCategory {
              name
            }
          }
        }
      }
    }
  }
`;
