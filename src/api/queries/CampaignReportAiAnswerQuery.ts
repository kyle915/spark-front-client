import { graphql } from "react-relay";

/**
 * On-demand freeform Q&A over a single Request's campaign report.
 *
 * Sibling of `campaignReportAiSummary`: fired only when an admin types a
 * question and clicks "Ask" on the report view (/report-view/:requestId) —
 * never on mount — so we don't pay the model cost for every page load. The
 * card runs this imperatively via `fetchQuery(environment, …).toPromise()`.
 *
 * The answer is grounded strictly in that one campaign's aggregated data.
 * `ok` gates the result: when true, `answer` holds the generated reply to
 * render; when false, `reason` carries a human-readable explanation (e.g.
 * the question couldn't be answered from the data) to show muted instead.
 */
export const CampaignReportAiAnswerQuery = graphql`
  query CampaignReportAiAnswerQuery($requestId: ID!, $question: String!) {
    campaignReportAiAnswer(requestId: $requestId, question: $question) {
      ok
      answer
      reason
    }
  }
`;
