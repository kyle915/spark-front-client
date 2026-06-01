import { graphql } from "react-relay";

/**
 * Consumer-sentiment summary for a single client (tenant) — an AI rollup of the
 * verbatim consumer-feedback text captured across that tenant's recaps. Returns
 * an `overallSentiment` ("positive" / "mixed" / "negative"), a prominent
 * `positivePct`, a short `summary`, a set of `themes` (each a `label` + `tone`),
 * and `quotes` (VERBATIM consumer words, each with a `tone`), plus the
 * `sampleSize` (how many pieces of feedback the summary is drawn from).
 *
 * Powers the <TenantSentimentCard> mounted right after <TenantInsightsPanel> on
 * both dashboards (the admin home dashboard and the client dashboard) and the
 * admin client-detail page, scoped to the active tenant from
 * `useAuthStore().tenantId` (the route `:tenantId` on the detail page). Like the
 * Insights / KPI rollups this is a plain read — components load it the usual way
 * (useLazyLoadQuery / store-or-network) so it paints on mount.
 *
 * This is the ALL-TIME view (no `year` argument). `tenantSentiment` resolves to
 * null when there isn't enough consumer-feedback text yet to summarize; the card
 * renders nothing in that case (many tenants won't have feedback text yet). The
 * first load per tenant per day triggers a cached AI summary server-side — that
 * is expected. `generatedAt` is when that summary was last computed.
 */
export const TenantSentimentQuery = graphql`
  query TenantSentimentQuery($tenantId: ID!) {
    tenantSentiment(tenantId: $tenantId) {
      overallSentiment
      positivePct
      summary
      themes {
        label
        tone
      }
      quotes {
        text
        tone
      }
      sampleSize
      generatedAt
    }
  }
`;
