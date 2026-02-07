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
      totalEngagements
      productsSold
      totalEarnings
      accountSpendAmount
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
      }
      recapFiles {
        id
        uuid
        name
        approved
        file
        fileTypeId
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
