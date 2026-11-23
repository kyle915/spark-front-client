import { graphql } from "react-relay";

export const UpsertDemoBudgetTargetMutation = graphql`
  mutation RoiPacingMutationsUpsertDemoBudgetTargetMutation(
    $targetAmount: String!
    $month: String
    $scopeType: String!
    $scopeKey: String!
    $scopeLabel: String!
    $notes: String!
  ) {
    upsertDemoBudgetTarget(
      targetAmount: $targetAmount
      month: $month
      scopeType: $scopeType
      scopeKey: $scopeKey
      scopeLabel: $scopeLabel
      notes: $notes
    ) {
      ok
      reason
      target {
        uuid
        scopeType
        scopeKey
        scopeLabel
        targetAmount
        notes
      }
    }
  }
`;

/** Shared discard — clears the notice for every Ignite admin, not localStorage. */
export const DiscardTodayAttentionItemsMutation = graphql`
  mutation RoiPacingMutationsDiscardTodayAttentionItemsMutation(
    $items: [TodayAttentionDiscardItemInput!]!
  ) {
    discardTodayAttentionItems(items: $items) {
      ok
      reason
      discardedCount
      fingerprints
    }
  }
`;
