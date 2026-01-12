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
      event {
        id
        uuid
        name
        tenantId
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
        createdAt
        fileRecapCategory {
          id
          name
        }
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
