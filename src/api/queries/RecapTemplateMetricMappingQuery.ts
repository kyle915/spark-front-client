import { graphql } from "react-relay";

/**
 * What each field of a recap template counts as: by its wording today
 * (`currentMetric`), by staff's confirmation (`confirmedMetric`), plus the
 * standard numbers that have no field on the form. Staff only — the server
 * returns null for anyone else.
 */
export const RecapTemplateMetricMappingQuery = graphql`
  query RecapTemplateMetricMappingQuery($templateId: ID!) {
    recapTemplateMetricMapping(templateId: $templateId) {
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
`;
