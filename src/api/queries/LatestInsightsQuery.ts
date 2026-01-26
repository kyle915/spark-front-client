import { graphql } from "react-relay";

export const LatestInsightsQuery = graphql`
  query LatestInsightsQuery($tenantId: ID) {
    latestInsights(tenantId: $tenantId) {
      totalFeedbackCount
      reports {
        id
        uuid
        title
        content
        priority
        createdAt
      }
    }
  }
`;
