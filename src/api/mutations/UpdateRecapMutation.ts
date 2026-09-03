import { graphql } from "react-relay";

/**
 * Update a legacy (non-custom-template) recap.
 *
 * Selection mirrors the editable / displayed RecapQuery fields so Relay
 * merges saved values into the store immediately. Returning only
 * id/name/eventId left numbers, BA, feedback, and samples stale in the UI
 * until a hard reload (persist was fine; the store never learned the new
 * values).
 */
export const UpdateRecapMutation = graphql`
  mutation UpdateRecapMutation($input: UpdateRecapInput!) {
    updateRecap(input: $input) {
      success
      message
      clientMutationId
      recap {
        id
        uuid
        name
        eventId
        createdAt
        updatedAt
        productsSold
        totalCansSold
        totalPacksSold
        totalEarnings
        accountSpendAmount
        trafficDescription
        competitivePresence
        externalBaName
        totalEngagements
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
  }
`;
