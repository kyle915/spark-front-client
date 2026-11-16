import { graphql } from "react-relay";

/**
 * The best photos from approved recaps in a date range, for the program
 * report's "From the field" section. Empty until photos have been picked.
 */
export const ReportsBestPhotosQuery = graphql`
  query ReportsBestPhotosQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
    $first: Int!
  ) {
    tenantPhotoGallery(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      picksOnly: true
      first: $first
      offset: 0
    ) {
      total
      photos {
        id
        url
        caption
        store
        state
        eventDate
      }
    }
  }
`;

export default ReportsBestPhotosQuery;
