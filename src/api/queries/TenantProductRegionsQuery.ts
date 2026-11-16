import { graphql } from "react-relay";

/**
 * The client's leading product in each state, three ways that are never
 * combined: units sold and samples handed out (added up from approved
 * recaps' per-product lines, no AI), and the product people spoke best of
 * (AI tags each comment that names a product; the server counts).
 *
 * Each `*Status` is "ready", "too_few" (not enough recaps or events in the
 * state to name a product) or "no_leader". `commentsStatus` is "ready",
 * "none" or "unavailable" and covers only the comment column.
 */
export const TenantProductRegionsQuery = graphql`
  query TenantProductRegionsQuery(
    $tenantId: ID!
    $startDate: String
    $endDate: String
  ) {
    tenantProductRegions(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
    ) {
      status
      commentsStatus
      hasSold
      hasSampled
      recapCount
      minStateRecaps
      states {
        state
        recaps
        soldStatus
        soldProduct
        soldUnits
        soldRecaps
        sampledStatus
        sampledProduct
        sampledUnits
        sampledRecaps
        spokenStatus
        spokenProduct
        spokenPositive
        spokenNegative
        spokenRecaps
      }
    }
  }
`;
