import { graphql } from "react-relay";

/**
 * Delete a per-client (tenant) consumer rebate campaign.
 *
 * The backend hard-deletes an empty campaign and soft-archives one that
 * already has receipts; either way it returns a human-readable `message`
 * the dashboard surfaces in a toast before refetching the campaign list.
 * Reuses ReceiptCampaignResponse; only success + message are needed here.
 */
export const DeleteReceiptCampaignMutation = graphql`
  mutation DeleteReceiptCampaignMutation($input: DeleteReceiptCampaignInput!) {
    deleteReceiptCampaign(input: $input) {
      success
      message
      clientMutationId
    }
  }
`;
