import { graphql } from "react-relay";

/**
 * Shelf photos on one recap with what was read from each, for staff review.
 *
 * Ignite staff only: anyone else gets `allowed: false` and no photos.
 * Loading this reads nothing new. `status` is "pending" (not read yet),
 * "read" or "unreadable" (not a shelf photo). A `correction` is a staff
 * member's own answers and is the answer when present.
 */
export const RecapShelfReadingsQuery = graphql`
  query RecapShelfReadingsQuery($recapId: ID!) {
    recapShelfReadings(recapId: $recapId) {
      allowed
      message
      photos {
        fileId
        fileUrl
        bucketName
        status
        reading {
          productOnShelf
          facings
          priceTagVisible
          price
          outOfStockGap
        }
        correction {
          answers {
            productOnShelf
            facings
            priceTagVisible
            price
            outOfStockGap
          }
          note
          correctedByName
          correctedAt
        }
      }
    }
  }
`;
