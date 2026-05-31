import { graphql } from "react-relay";

/**
 * Create a per-client (tenant) consumer rebate campaign.
 *
 * Returns the created campaign so the dashboard can refresh the list in
 * place. rewardAmount is sent as a Float (dollars); the server echoes it
 * back as a formatted string on the campaign.
 */
export const CreateReceiptCampaignMutation = graphql`
  mutation CreateReceiptCampaignMutation($input: CreateReceiptCampaignInput!) {
    createReceiptCampaign(input: $input) {
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
      }
    }
  }
`;
