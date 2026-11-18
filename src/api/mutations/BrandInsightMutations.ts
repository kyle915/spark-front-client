import { graphql } from "react-relay";

/** Work out one brand's findings again. New and changed ones are drafts. */
export const GenerateBrandInsightsMutation = graphql`
  mutation BrandInsightMutationsGenerateMutation($tenantId: ID!) {
    generateBrandInsights(tenantId: $tenantId) {
      ok
      reason
      count
    }
  }
`;

/** Publish every current draft for one brand (or only `ids`). Sends nothing. */
export const PublishBrandInsightsMutation = graphql`
  mutation BrandInsightMutationsPublishMutation($tenantId: ID!, $ids: [ID!]) {
    publishBrandInsights(tenantId: $tenantId, ids: $ids) {
      ok
      reason
      count
    }
  }
`;

/** Publish one finding, hide it, or put it back to draft. */
export const SetBrandInsightStatusMutation = graphql`
  mutation BrandInsightMutationsStatusMutation($id: ID!, $status: String!) {
    setBrandInsightStatus(id: $id, status: $status) {
      ok
      reason
      item {
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
