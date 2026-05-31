import { graphql } from "react-relay";

/**
 * On-demand AI executive summary for a single Request's campaign report.
 *
 * Fired only when an admin clicks "Generate" on the report view
 * (/report-view/:requestId) — never on mount — so we don't pay the model
 * cost for every page load. The card runs this imperatively via
 * `fetchQuery(environment, …).toPromise()`.
 *
 * `ok` gates the result: when true, `summary` holds the generated copy to
 * render; when false, `reason` carries a human-readable explanation (e.g.
 * the model key isn't configured) to show muted instead.
 */
export const CampaignReportAiSummaryQuery = graphql`
  query CampaignReportAiSummaryQuery($requestId: ID!) {
    campaignReportAiSummary(requestId: $requestId) {
      ok
      summary
      reason
    }
  }
`;
