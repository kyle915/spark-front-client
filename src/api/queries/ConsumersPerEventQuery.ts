import { graphql } from "react-relay";

/**
 * Consumers sampled and the number of events behind that total, for
 * "consumers sampled per event". Same rollup as ConsumerBreakdownQuery
 * (approved recaps, dated by the event). Kept as its own document so the
 * week, store and state charts still load against a server that does not
 * have `events` yet.
 */
export const ConsumersPerEventQuery = graphql`
  query ConsumersPerEventQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantConsumerBreakdown(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      total
      events
    }
  }
`;
