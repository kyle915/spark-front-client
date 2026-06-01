import { graphql } from "react-relay";

/**
 * Persist the annual goal targets for a tenant — the four goal-tracked program
 * metrics (consumers reached, samples distributed, products sold, total
 * engagements) for a given `year`. Each target is optional; passing null leaves
 * that metric without a target (pace shows "Set a target").
 *
 * Returns the recomputed `TenantGoals` (targets + current totals + pace) so the
 * <TenantGoalsPanel> Edit-goals modal can confirm the save; the panel then
 * bumps its `fetchKey` to refetch the read query and repaint the pace bars.
 */
export const SetTenantGoalsMutation = graphql`
  mutation SetTenantGoalsMutation(
    $tenantId: ID!
    $year: Int!
    $targetConsumersReached: Int
    $targetSamplesDistributed: Int
    $targetProductsSold: Int
    $targetTotalEngagements: Int
  ) {
    setTenantGoals(
      tenantId: $tenantId
      year: $year
      targetConsumersReached: $targetConsumersReached
      targetSamplesDistributed: $targetSamplesDistributed
      targetProductsSold: $targetProductsSold
      targetTotalEngagements: $targetTotalEngagements
    ) {
      year
      items {
        metric
        label
        target
        current
        pacePct
      }
    }
  }
`;
