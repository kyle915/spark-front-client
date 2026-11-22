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
