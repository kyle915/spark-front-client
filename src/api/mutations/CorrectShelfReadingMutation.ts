import { graphql } from "react-relay";

/**
 * Store a staff correction for one shelf photo. It is kept apart from what
 * was read and is the answer from then on. Ignite staff only.
 */
export const CorrectShelfReadingMutation = graphql`
  mutation CorrectShelfReadingMutation($input: CorrectShelfReadingInput!) {
    correctShelfReading(input: $input) {
      success
      message
      photo {
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
