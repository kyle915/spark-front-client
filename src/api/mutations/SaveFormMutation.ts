import { graphql } from "react-relay";

/**
 * Create a new custom form definition for a tenant (Form Builder).
 *
 * `name` + `isPublished` are top-level columns; description, the
 * internal/external targets and the field list are packed into the
 * `schema` JSON blob. Callers derive isPublished = internal || external.
 *
 * Returns the saved `form` (including the backend-assigned `id`) so the
 * builder can adopt the real id without an extra round-trip; the page
 * also refetches tenantForms after the write. Counterparts:
 * UpdateFormMutation / DeleteFormMutation.
 */
export const SaveFormMutation = graphql`
  mutation SaveFormMutation($input: SaveFormInput!) {
    saveForm(input: $input) {
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
