import { graphql } from "react-relay";

/**
 * On-demand freeform Q&A over a single client's (tenant's) whole program.
 *
 * Sibling of `campaignReportAiAnswer`, but scoped to a tenant rather than a
 * single Request: fired only when someone types a question and clicks "Ask"
 * in the Ask-AI pop-up on a dashboard — never on mount — so we don't pay the
 * model cost for every page load. The component runs this imperatively via
 * `fetchQuery(environment, …).toPromise()`.
 *
 * The answer is grounded in everything we have for that one client —
 * aggregated events, recaps, and KPIs. `ok` gates the result: when true,
 * `answer` holds the generated reply to render; when false, `reason` carries
 * a human-readable explanation (e.g. the question couldn't be answered from
 * the data) to show muted instead.
 */
export const TenantAiAnswerQuery = graphql`
  query TenantAiAnswerQuery(
    $tenantId: ID!
    $question: String!
    $recapId: ID
    $eventId: ID
  ) {
    tenantAiAnswer(
      tenantId: $tenantId
      question: $question
      recapId: $recapId
      eventId: $eventId
    ) {
      ok
      answer
      reason
      chart {
        type
        title
        labels
        series {
          label
          data
        }
      }
    }
  }
`;
