import { graphql } from "react-relay";

export const RecapQuery = graphql`
  query RecapQuery($uuid: ID!) {
    recap(uuid: $uuid) {
      id
      uuid
      name
      createdAt
      updatedAt
      approved
      shareToken
      totalEngagements
      productsSold
      totalCansSold
      totalPacksSold
      totalEarnings
      accountSpendAmount
      trafficDescription
      competitivePresence
      externalBaName
      job {
        id
        uuid
        name
      }
      event {
        id
        uuid
        name
        date
        tenantId
        tenant {
          id
          name
          slug
        }
        timezone {
          id
          name
          code
          offset
        }
        startTime
        endTime
        address
        isNational
        notes
        eventType {
          name
          id
          isDefault
        }
        request {
          name
          date
          startTime
          endTime
          address
          id
          retailer {
            id
            uuid
            name
          }
        }
      }
      consumerEngagements {
        id
        uuid
        totalConsumer
        firstTimeConsumers
        brandAwareConsumers
        willingToPurchaseConsumers
        notWillingConsumers
      }
      productSamples {
        id
        uuid
        quantity
        product {
          id
          uuid
          name
          image
        }
      }
      salesPerformance {
        id
        uuid
        price
        product {
          id
          uuid
          name
          image
        }
        typeOfGood {
          id
          uuid
          name
        }
      }
      consumerFeedback {
        id
        uuid
        demographics
        feedback
        quotes
        positiveStories
        reasonsToDecline
      }
      accountFeedback {
        id
        uuid
        doDifferentlyFeedback
        feedback
        corpoCard
        wasCorpoCardUsed
      }
      recapFiles {
        id
        uuid
        name
        approved
        file
        # Browser-renderable URL. For HEIC uploads this is the
        # server-converted .jpg sibling (a plain img works, with no
        # in-browser HEIC decode or bucket-CORS dependency); otherwise
        # it equals the file field.
        displayUrl
        fileTypeId
        fileType {
          id
          name
          extension
        }
        fileRecapCategoryId
        fileRecapCategory {
          id
          name
        }
        createdAt
      }
      requestStoreManagers {
        id
        uuid
        name
        phone
        createdAt
        updatedAt
      }
      ambassadors {
        id
        uuid
        rating
        address
        user {
          id
          uuid
          firstName
          lastName
        }
        createdAt
        updatedAt
      }
    }
  }
`;
