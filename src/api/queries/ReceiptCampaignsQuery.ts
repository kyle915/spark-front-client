import { graphql } from "react-relay";

/**
 * Per-client (tenant) consumer rebate campaigns.
 *
 * Backs the admin Receipts dashboard. Each campaign is always-on: a brand
 * runs it, consumers upload a purchase receipt via the public no-login page
 * (/c/<slug>), an admin validates it, then pays a fixed reward via PayPal.
 * Filters are tenant / active scoped on the server. Counts roll up the
 * campaign's submissions by state for the dashboard tiles.
 */
export const ReceiptCampaignsQuery = graphql`
  query ReceiptCampaignsQuery($filters: ReceiptCampaignFiltersInput) {
    receiptCampaigns(filters: $filters) {
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
`;
