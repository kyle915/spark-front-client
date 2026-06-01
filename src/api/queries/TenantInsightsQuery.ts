import { graphql } from "react-relay";

/**
 * Bucket scoreboard for a single client (tenant) — a fixed set of deterministic
 * categories the backend computes from that tenant's program. Each item is a
 * bucket carrying a `title` (category label, e.g. "Reach"), a `metric` (the
 * headline number as a preformatted string, e.g. "147,466"), a `detail`
 * one-line takeaway, a `sentiment` ("positive" / "neutral" / "attention"), and
 * a stable `key` slug (`reach` / `sampling` / `sales` / `new_audience` /
 * `momentum`) used to map the leading icon. `key` may be null for legacy data.
 *
 * Powers the <TenantInsightsPanel> mounted on both dashboards (the admin home
 * dashboard and the client dashboard), scoped to the active tenant from
 * `useAuthStore().tenantId`. Like the KPI rollup this is a plain read —
 * components load it the usual way (useLazyLoadQuery / store-or-network) so it
 * paints on mount rather than firing on a click.
 *
 * `generatedAt` is when the buckets were last computed (shown as a small
 * caption). When the tenant has nothing worth surfacing yet, `items` is empty
 * and the panel renders a quiet empty state.
 */
export const TenantInsightsQuery = graphql`
  query TenantInsightsQuery($tenantId: ID!) {
    tenantInsights(tenantId: $tenantId) {
      generatedAt
      items {
        title
        detail
        sentiment
        metric
        key
      }
    }
  }
`;
