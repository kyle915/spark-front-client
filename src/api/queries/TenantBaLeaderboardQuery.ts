import { graphql } from "react-relay";

/**
 * Top-performer leaderboard for a single client (tenant) — the brand ambassadors
 * who worked that tenant's program, returned pre-sorted by the backend
 * (avgRating desc → recapsFiled desc → shiftsWorked desc) and capped server-side
 * so the client just renders the rows. Each entry carries the BA's `baId` +
 * `name`, how many shifts they worked (`shiftsWorked`), how many recaps they
 * filed (`recapsFiled`), and their rating aggregate: `avgRating` (null when the
 * BA is unrated) over `ratingsCount` ratings.
 *
 * `reliabilityPct` is reserved for a future on-time/reliability score; the
 * backend currently always returns null for it (the data doesn't support it
 * yet), so the panel hides that stat unless at least one entry has a non-null
 * value.
 *
 * Powers the <TenantBaLeaderboard> card mounted on both dashboards (the admin
 * home dashboard and the client dashboard), scoped to the active tenant from
 * `useAuthStore().tenantId`. Like the KPI rollup, insights and goals this is a
 * plain read — components load it the usual way (useLazyLoadQuery /
 * store-or-network) so it paints on mount rather than firing on a click. This
 * query loads the all-time leaderboard (no `year` argument); the schema field
 * accepts an optional `year` for a future per-year view.
 *
 * When the tenant has no BA performance data yet the list is empty and the card
 * renders a quiet empty state.
 */
export const TenantBaLeaderboardQuery = graphql`
  query TenantBaLeaderboardQuery($tenantId: ID!) {
    tenantBaLeaderboard(tenantId: $tenantId) {
      baId
      name
      shiftsWorked
      recapsFiled
      avgRating
      ratingsCount
      reliabilityPct
    }
  }
`;
