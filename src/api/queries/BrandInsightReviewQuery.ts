import { graphql } from "react-relay";

/**
 * Every brand's current store recommendations and alerts, for Ignite staff
 * to publish or hide. Null for anyone else. Never asks the model.
 */
export const BrandInsightReviewQuery = graphql`
  query BrandInsightReviewQuery {
    brandInsightReview {
      tenantId
      tenantName
      drafts
      items {
        id
        kind
        code
        subject
        text
        template
        factsText
        source
        status
        periodStart
        periodEnd
        generatedAt
        reviewedByName
        reviewedAt
      }
    }
  }
`;
