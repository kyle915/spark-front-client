import { graphql } from "react-relay";

/**
 * Consumer receipt validation queue.
 *
 * Backs the admin Receipts page. Receipts are submitted by consumers
 * via the public no-login upload page and land here for an admin to
 * validate or reject. Filters are tenant / event / status scoped on
 * the server; the page defaults to status pending.
 */
export const ReceiptsQuery = graphql`
  query ReceiptsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: ConsumerReceiptFiltersInput
  ) {
    receipts(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          __typename
          id
          uuid
          status
          submittedAt
          createdAt
          updatedAt
          eventId
          eventName
          consumerName
          consumerEmail
          consumerPhone
          storeName
          purchaseDate
          amount
          product
          reviewNote
          reviewedAt
          publicUrl
          campaign {
            id
            name
          }
          campaignName
          payoutMethod
          payoutHandle
          rewardAmount
          paidAt
          payoutLink
          isFlagged
          flagReason
          ocrStore
          ocrAmount
          ocrDate
          ocrText
          ocrRanAt
          reviewedBy {
            __typename
            uuid
            email
            firstName
            lastName
          }
        }
      }
    }
  }
`;
