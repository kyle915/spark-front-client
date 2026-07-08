import { graphql } from "react-relay";

/**
 * On-demand Gemini narrative over one Field Sampling Report window's
 * deterministic call-outs feed. Same args as
 * `TenantFieldSamplingReportQuery` (the frontend calls this with whatever
 * window/market it's currently showing) — never fired automatically, only
 * from an explicit "Summarize with AI" click, so the report's numbers are
 * never gated behind an AI call. `summary` is null when Gemini is
 * unavailable/fails or there were no call-outs to summarize; the caller
 * always still has the deterministic call-outs feed to show.
 */
export const GenerateFieldSamplingCalloutSummaryMutation = graphql`
  mutation GenerateFieldSamplingCalloutSummaryMutation(
    $tenantId: ID!
    $startDate: String!
    $endDate: String!
    $eventTypeId: ID
    $market: String
  ) {
    generateFieldSamplingCalloutSummary(
      tenantId: $tenantId
      startDate: $startDate
      endDate: $endDate
      eventTypeId: $eventTypeId
      market: $market
    ) {
      summary
    }
  }
`;
