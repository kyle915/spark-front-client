import { graphql } from "react-relay";

/**
 * Create a CustomRecap from the manual "+ New recap" form for tenants on
 * a Custom Recap Template (Girl Beer, Borjomi, Liquid Death, …).
 *
 * Counterpart to CreateRecapMutation (which only writes the legacy fixed
 * `Recap` model). The admin picks an event + the tenant's template, fills
 * the template's real fields, and we persist a CustomRecap + one
 * CustomFieldValue per filled field (`customFieldValues`). Returns the
 * recap uuid so the form can navigate to /recap/view-custom/:uuid.
 */
export const CreateCustomRecapMutation = graphql`
  mutation CreateCustomRecapMutation($input: CreateCustomRecapInput!) {
    createCustomRecap(input: $input) {
      success
      message
      clientMutationId
      customRecap {
        id
        uuid
        name
        usedCorpoCard
        totalEngagements
      }
    }
  }
`;
