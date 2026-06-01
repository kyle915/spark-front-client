import { graphql } from "react-relay";

/**
 * Update an existing custom form definition (Form Builder).
 *
 * Sends the full `name` + `schema` blob (description, internal/external
 * targets, field list) plus the derived `isPublished` (internal ||
 * external) for the form identified by `id`. Returns the merged `form`
 * so the Relay store stays in sync; the page also refetches tenantForms
 * after the write. Counterpart to SaveFormMutation.
 */
export const UpdateFormMutation = graphql`
  mutation UpdateFormMutation($input: UpdateFormInput!) {
    updateForm(input: $input) {
      success
      message
      form {
        id
        name
        schema
        isPublished
        createdAt
        updatedAt
      }
    }
  }
`;
