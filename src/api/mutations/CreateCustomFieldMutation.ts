import { graphql } from "react-relay";

/**
 * Add a single CustomField to an existing CustomRecapTemplate without
 * recreating the whole template.
 *
 * The create-template builder (/recap-templates/new) only stamps fields
 * at creation time via createCustomRecapTemplate. Once a template is
 * live, the "Manage fields" modal uses this focused mutation to append
 * one field (e.g. "Products Sampled") to a template that's already
 * collecting recaps.
 *
 * Counterpart to RemoveCustomFieldMutation. The backend attaches the
 * field to the given customRecapTemplateId + recapSectionId with the
 * chosen customFieldTypeId. We select the created customField so callers
 * can confirm + (if they want) read its id without an extra round-trip;
 * the modal refetches the template list to surface it in-place.
 */
export const CreateCustomFieldMutation = graphql`
  mutation CreateCustomFieldMutation($input: CreateCustomFieldInput!) {
    createCustomField(input: $input) {
      success
      message
      customField {
        id
        name
        required
      }
    }
  }
`;
