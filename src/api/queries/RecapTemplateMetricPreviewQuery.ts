import { graphql } from "react-relay";

/**
 * Staff check before a recap template is saved: which standard numbers the
 * draft would have no field for, and which number fields read like a count
 * but would not be counted. Stores nothing. Null for non-staff.
 */
export const RecapTemplateMetricPreviewQuery = graphql`
  query RecapTemplateMetricPreviewQuery(
    $templateId: ID
    $productSamples: Boolean!
    $fields: [RecapFieldPreviewInput!]!
  ) {
    recapTemplateMetricPreview(
      templateId: $templateId
      productSamples: $productSamples
      fields: $fields
    ) {
      missingMetrics {
        key
        label
      }
      uncountedFields
    }
  }
`;
