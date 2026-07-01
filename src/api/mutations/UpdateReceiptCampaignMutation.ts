import { graphql } from "react-relay";

/**
 * Update a per-client (tenant) consumer rebate campaign.
 *
 * Toggling isActive flips the public page on/off (an inactive campaign
 * 404s the public /c/<slug> page). Returns the updated campaign so the
 * dashboard reflects the new state without a refetch.
 */
export const UpdateReceiptCampaignMutation = graphql`
  mutation UpdateReceiptCampaignMutation($input: UpdateReceiptCampaignInput!) {
    updateReceiptCampaign(input: $input) {
      success
      message
      clientMutationId
      campaign {
        id
        uuid
        name
        slug
        headline
        description
        product
        rewardAmount
        payoutNote
        isActive
        receiptsCount
        pendingCount
        validatedCount
        paidCount
        createdAt
        updatedAt
        budgetCap
        totalPaid
        totalCommitted
        budgetRemaining
        heroImage
        productImage
      }
    }
  }
`;
