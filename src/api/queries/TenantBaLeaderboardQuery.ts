import { graphql } from "react-relay";

/**
 * Top-performer BA leaderboard for one tenant. Optional `startDate` /
 * `endDate` scope to the Insights page range. `reliabilityPct` stays hidden
 * in UI until the API fills it; `consumersReached` / `samplesDistributed`
 * power staffing-useful rows when present.
 */
export const TenantBaLeaderboardQuery = graphql`
  query TenantBaLeaderboardQuery(
    $tenantId: ID!
    $year: Int
    $startDate: String
    $endDate: String
  ) {
    tenantBaLeaderboard(
      tenantId: $tenantId
      year: $year
      startDate: $startDate
      endDate: $endDate
    ) {
      baId
      name
      shiftsWorked
      recapsFiled
      consumersReached
      samplesDistributed
      avgRating
      ratingsCount
      reliabilityPct
    }
  }
`;
