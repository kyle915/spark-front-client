import { graphql } from "react-relay";

/**
 * Read this recap's unread shelf photos now. Ignite staff only. A photo
 * that already has an answer is not read again.
 */
export const ReadRecapShelfPhotosMutation = graphql`
  mutation ReadRecapShelfPhotosMutation($recapId: ID!) {
    readRecapShelfPhotos(recapId: $recapId) {
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
