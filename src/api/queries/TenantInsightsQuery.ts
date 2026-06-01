import { graphql } from "react-relay";

/**
 * Proactive insight cards for a single client (tenant) — short, plain-language
 * call-outs the model surfaces from that tenant's program (e.g. "Sampling is up
 * 18% vs last month", "3 markets have gone quiet"). Each item carries a `title`,
 * a `detail` line, a `sentiment` ("positive" / "neutral" / "attention") used to
 * color-code the card, and an optional `metric` badge.
 *
 * Powers the <TenantInsightsPanel> mounted on both dashboards (the admin home
 * dashboard and the client dashboard), scoped to the active tenant from
 * `useAuthStore().tenantId`. Like the KPI rollup this is a plain read —
 * components load it the usual way (useLazyLoadQuery / store-or-network) so it
 * paints on mount rather than firing on a click.
 *
 * `generatedAt` is when the insights were last computed (shown as a small
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
      }
    }
  }
`;
