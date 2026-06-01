import { graphql } from "react-relay";

/**
 * Annual goals + pace-to-target for a single client (tenant) — the four
 * goal-tracked program metrics (consumers reached, samples distributed,
 * products sold, total engagements) with each one's `target`, the `current`
 * running total, and a `pacePct` (= current / target * 100; 0 when no target
 * is set, and free to exceed 100 when ahead of plan).
 *
 * Powers the <TenantGoalsPanel> mounted on both dashboards (the admin home
 * dashboard and the client dashboard), scoped to the active tenant from
 * `useAuthStore().tenantId`. Like the KPI rollup and insights this is a plain
 * read — components load it the usual way (useLazyLoadQuery / store-or-network)
 * so it paints on mount rather than firing on a click.
 *
 * `year` narrows to a single calendar year; pass null (the default) for the
 * current year. The panel reads the current year, and bumps a `fetchKey` to
 * refetch after the Edit-goals modal saves via `setTenantGoals`. Each item
 * carries a stable `metric` slug plus a human `label` for the row heading.
 */
export const TenantGoalsQuery = graphql`
  query TenantGoalsQuery($tenantId: ID!, $year: Int) {
    tenantGoals(tenantId: $tenantId, year: $year) {
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
