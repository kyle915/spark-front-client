import { graphql } from "react-relay";

/**
 * Book ONE ambassador onto MANY events in a single call — powers the
 * Staffing Board's "pick a BA, click every empty slot, assign" flow.
 * Each event is booked (is_approved=True) through the same idempotent
 * path as the single-shift Assign, so re-assigning is always safe.
 */
export const BulkAssignAmbassadorMutation = graphql`
  mutation BulkAssignAmbassadorMutation($input: BulkAssignAmbassadorInput!) {
    bulkAssignAmbassadorToEvents(input: $input) {
      success
      message
      assignedCount
      failedCount
    }
  }
`;
