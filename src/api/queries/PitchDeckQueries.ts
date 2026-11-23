import { graphql } from "react-relay";

export const PitchDeckQueriesPhotoWallQuery = graphql`
  query PitchDeckQueriesPhotoWallQuery(
    $startDate: String
    $endDate: String
    $retailer: String
    $market: String
    $sku: String
    $category: String
    $search: String
    $pinnedOnly: Boolean!
    $first: Int!
    $offset: Int!
  ) {
    photoWall(
      startDate: $startDate
      endDate: $endDate
      retailer: $retailer
      market: $market
      sku: $sku
      category: $category
      search: $search
      pinnedOnly: $pinnedOnly
      first: $first
      offset: $offset
    ) {
      total
      pinnedCount
      retailers
      markets
      skus
      categories
      photos {
        id
        url
        category
        caption
        store
        retailer
        market
        state
        eventDate
        skus
        recapUuid
        isPinned
        pinnedAt
        pinNote
      }
    }
  }
`;

export const PitchDeckQueriesBuyerPitchDecksQuery = graphql`
  query PitchDeckQueriesBuyerPitchDecksQuery {
    buyerPitchDecks {
      uuid
      token
      title
      subtitle
      buyerName
      periodStart
      periodEnd
      retailerFilter
      marketFilter
      includeCosts
      hasPasscode
      expiresAt
      revokedAt
      photoCount
      viewCount
      createdAt
      createdByEmail
    }
  }
`;
