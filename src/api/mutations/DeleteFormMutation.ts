import { graphql } from "react-relay";

/**
 * Delete a custom form definition by id (Form Builder).
 *
 * Returns `deletedId` so callers can confirm the removal; the page
 * refetches tenantForms after the write so the row drops out without a
 * manual refresh. Counterpart to SaveFormMutation / UpdateFormMutation.
 */
export const DeleteFormMutation = graphql`
  mutation DeleteFormMutation($input: DeleteFormInput!) {
    deleteForm(input: $input) {
      success
      message
      deletedId
    }
  }
`;
