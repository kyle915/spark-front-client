import { graphql } from "react-relay";

/**
 * What consumers mention, month by month, for one client.
 *
 * Each approved recap's consumer comments are tagged once (AI, on a
 * schedule) with the brand's fixed theme list and the other brands they
 * name. Every count here is worked out on the server from those tags and is
 * recaps, not comments; `counts` lines up with `months` (YYYY-MM, oldest
 * first). `direction` compares `compareMonth` with `priorMonth` by share of
 * recaps read and is "rising" or "falling" only past the server's floors.
 * `quote` is one consumer comment as written. `headlines` are sentences
 * built from the counts, not model prose.
 *
 * `status` is "ready", "not_tagged" (nothing read yet), "too_few" or
 * "unavailable".
 */
export const TenantMentionTrendsQuery = graphql`
  query TenantMentionTrendsQuery($tenantId: ID!, $endDate: String, $months: Int) {
    tenantMentionTrends(tenantId: $tenantId, endDate: $endDate, months: $months) {
      status
      months
      recapCounts
      compareMonth
      priorMonth
      minMonthRecaps
      minTrendMentions
      otherCount
      headlines
      taggedAt
      themes {
        key
        label
        polarity
        counts
        total
        current
        previous
        currentShare
        previousShare
        direction
        quote
      }
      brands {
        key
        label
        counts
        total
        current
        previous
        currentShare
        previousShare
        direction
      }
    }
  }
`;
