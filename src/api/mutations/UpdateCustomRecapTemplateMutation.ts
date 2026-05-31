import { graphql } from "react-relay";

/**
 * Update an existing CustomRecapTemplate.
 *
 * Used by /recap-templates to flip the per-template "Track sampled
 * products" (product_samples) flag on a template that already exists —
 * the last-mile enablement so a tenant's recap forms render the
 * per-SKU products-sampled section (forms key off
 * `template.productSamples === true`).
 *
 * SAFETY — partial update only. The backend
 * `_sync_custom_recap_template_fields` returns early when `customFields`
 * is null/omitted, so the template's existing CustomField rows are
 * PRESERVED. Callers flipping a flag must send ONLY the required
 * non-null inputs (`id`, `name`, `eventTypeId`) populated from the
 * template's CURRENT values plus the single field being changed
 * (`productSamples`). Do NOT send `customFields` — passing it risks
 * rewriting/wiping the template's fields.
 */
export const UpdateCustomRecapTemplateMutation = graphql`
  mutation UpdateCustomRecapTemplateMutation(
    $input: UpdateCustomRecapTemplateInput!
  ) {
    updateCustomRecapTemplate(input: $input) {
      success
      message
      customRecapTemplate {
        id
        productSamples
      }
    }
  }
`;
