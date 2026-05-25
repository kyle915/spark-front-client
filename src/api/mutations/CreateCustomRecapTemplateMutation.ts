import { graphql } from "react-relay";

/**
 * Create a CustomRecapTemplate (a per-tenant recap form) along with
 * its CustomField rows in one transaction.
 *
 * Used by /recap-templates/new — the admin builder Nevena requested
 * so onboarding new tenants doesn't require a developer to run the
 * `onboard_<tenant>` management commands by hand.
 */
export const CreateCustomRecapTemplateMutation = graphql`
  mutation CreateCustomRecapTemplateMutation(
    $input: CreateCustomRecapTemplateInput!
  ) {
    createCustomRecapTemplate(input: $input) {
      success
      message
      customRecapTemplate {
        id
        uuid
        name
        eventType {
          id
          name
        }
        customField {
          id
          name
          required
        }
      }
    }
  }
`;
