import { graphql } from "react-relay";

/** Field photos from a brand's approved recaps, with filter choices. */
export const TenantPhotoGalleryQuery = graphql`
  query TenantPhotoGalleryQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
    $state: String
    $store: String
    $category: String
    $picksOnly: Boolean!
    $first: Int!
    $offset: Int!
  ) {
    tenantPhotoGallery(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      state: $state
      store: $store
      category: $category
      picksOnly: $picksOnly
      first: $first
      offset: $offset
    ) {
      total
      categories
      states
      photos {
        id
        url
        category
        recapUuid
        store
        state
        eventDate
        isPick
        caption
      }
    }
  }
`;

export default TenantPhotoGalleryQuery;
