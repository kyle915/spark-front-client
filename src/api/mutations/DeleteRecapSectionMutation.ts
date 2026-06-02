import { graphql } from "react-relay";

/**
 * Delete a RecapSection.
 *
 * Sections are tenant-global — shared across all of a client's
 * templates — so deleting one removes it everywhere for that client,
 * not just from the template being edited. The backend authoritatively
 * refuses to delete a section that still has fields attached; the
 * "Manage fields" modal additionally guards the button so an admin
 * can't even attempt it until the section is empty in this template.
 */
export const DeleteRecapSectionMutation = graphql`
  mutation DeleteRecapSectionMutation($input: DeleteRecapSectionInput!) {
    deleteRecapSection(input: $input) {
      success
      message
      deletedRecapSectionUuid
    }
  }
`;
