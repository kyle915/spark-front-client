import { graphql } from "react-relay";

export const ShelfVoiceHubQuery = graphql`
  query ShelfVoiceHubQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    shelfVoiceHub(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      status
      startDate
      endDate
      auditedVisits
      unreadVisits
      onShelfCount
      notFoundCount
      unclearCount
      osaRatePct
      priceTagVisibleCount
      missingTagCount
      priceTagRatePct
      oosGapsCount
      avgFacings
      medianPrice
      minPrice
      maxPrice
      pricedVisitsCount
      stores {
        storeKey
        storeName
        market
        stateCode
        visitCount
        latestDate
        latestRecapUuid
        latestStatus
        onShelfVisits
        notFoundVisits
        osaRatePct
        missingTagVisits
        oosGapVisits
        latestFacings
        avgFacings
        latestPrice
        priceDriftPct
        stockoutSignal
        competitorPromo
        hasBeforeAfter
      }
      shelfPhotos {
        fileId
        photoUrl
        bucketName
        storeKey
        storeName
        market
        stateCode
        eventDate
        recapUuid
        productOnShelf
        facings
        priceTagVisible
        price
        outOfStockGap
      }
      beforeAfterPairs {
        storeKey
        storeName
        market
        stateCode
        photoCount
        beforePhoto {
          fileId
          photoUrl
          bucketName
          storeKey
          storeName
          market
          stateCode
          eventDate
          recapUuid
          productOnShelf
          facings
          priceTagVisible
          price
          outOfStockGap
        }
        afterPhoto {
          fileId
          photoUrl
          bucketName
          storeKey
          storeName
          market
          stateCode
          eventDate
          recapUuid
          productOnShelf
          facings
          priceTagVisible
          price
          outOfStockGap
        }
      }
      competitorMarkets {
        market
        stateCode
        competitorBrand
        mentionCount
        priorMentionCount
        delta
        trend
        sampleQuote
        sampleStoreKey
        sampleStoreName
        sampleRecapUuid
      }
      competitorPromos {
        storeKey
        storeName
        market
        stateCode
        eventDate
        recapUuid
        competitorBrand
        detail
      }
    }
  }
`;
