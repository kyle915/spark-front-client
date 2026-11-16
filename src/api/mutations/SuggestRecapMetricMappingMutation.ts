import { graphql } from "react-relay";

/**
 * Ask for a proposed metric per template field. The server sends the model
 * field labels, types and choice options only, checks the proposal, and
 * stores nothing: the proposal comes back for a person to accept or change.
 */
export const SuggestRecapMetricMappingMutation = graphql`
  mutation SuggestRecapMetricMappingMutation($templateId: ID!) {
    suggestRecapMetricMapping(templateId: $templateId) {
      ok
      reason
      suggestions {
        fieldId
        metric
        packSize
        reason
      }
    }
  }
`;
