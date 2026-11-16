import { graphql } from "react-relay";

/**
 * Store the metrics a staff member confirmed for a template's fields. A
 * field sent with a null metric goes back to "not confirmed" (Spark goes by
 * its wording again). Returns the mapping as it now stands.
 */
export const SaveRecapMetricMappingMutation = graphql`
  mutation SaveRecapMetricMappingMutation(
    $templateId: ID!
    $fields: [RecapFieldMetricInput!]!
  ) {
    saveRecapMetricMapping(templateId: $templateId, fields: $fields) {
      ok
      message
      mapping {
        templateId
        fields {
          fieldId
          name
          fieldType
          section
          currentMetric
          confirmedMetric
          packSize
          confirmedBy
          confirmedAt
          canCount
        }
        missingMetrics {
          key
          label
        }
        metricOptions {
          key
          label
        }
      }
    }
  }
`;
