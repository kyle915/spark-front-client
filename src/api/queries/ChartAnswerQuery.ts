import { graphql } from "react-relay";

/**
 * A question about one chart. The page sends which chart it is (client,
 * dates, chart kind), never the figures: the server works them out again
 * and answers only from them. Fired when the question is submitted.
 */
export const ChartAnswerQuery = graphql`
  query ChartAnswerQuery(
    $tenantId: ID!
    $chart: String!
    $question: String!
    $startDate: String
    $endDate: String
  ) {
    chartAnswer(
      tenantId: $tenantId
      chart: $chart
      question: $question
      startDate: $startDate
      endDate: $endDate
    ) {
      ok
      answered
      answer
      reason
    }
  }
`;
