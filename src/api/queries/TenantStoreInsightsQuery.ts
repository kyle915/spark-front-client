import { graphql } from "react-relay";

/**
 * Store recommendations ("where to go next") and alerts for one brand's
 * dashboard. A brand user only ever gets findings Ignite staff published,
 * for a brand they belong to. Staff also get drafts, with `isDraft` true.
 * Reads stored rows; it never asks the model.
 */
export const TenantStoreInsightsQuery = graphql`
  query TenantStoreInsightsQuery($tenantId: ID!) {
    tenantStoreInsights(tenantId: $tenantId) {
      recommendations {
        id
        kind
        code
        subject
        text
        periodStart
        periodEnd
        isDraft
        scopeKey
        visitCount
        comparisonPeriod
        supportedCost
        adjustedPosUnits
        eligibleStores {
          storeKey
          storeLabel
        }
        currentActionUuid
        currentActionType
        currentActionStatus
        currentActionOwner
        currentActionProvider
      }
      alerts {
        id
        kind
        code
        subject
        text
        periodStart
        periodEnd
        isDraft
        scopeKey
        visitCount
        comparisonPeriod
      }
    }
  }
`;
