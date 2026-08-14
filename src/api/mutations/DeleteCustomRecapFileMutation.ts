import { graphql } from "react-relay";

/**
 * Remove one file from a custom recap's Evidences & Attachments gallery.
 *
 * Custom-template (Borjomi / Girl Beer) counterpart to
 * RemoveRecapFileMutation. Lets an admin delete a misfiled image/PDF
 * (e.g. a receipt that landed under "Table setup") from the recap. The
 * backend hard-deletes the CustomRecapFile row but LEAVES the GCS blob
 * (audit / recoverability); it's tenant-scoped + admin-only server-side.
 *
 * Returns the FULL customRecapFiles list so Relay merges it into the
 * store by custom recap id and the gallery re-renders without the deleted
 * file — no page reload. Field selection mirrors GetCustomRecapQuery's
 * customRecapFiles so the merge is complete.
 */
export const DeleteCustomRecapFileMutation = graphql`
  mutation DeleteCustomRecapFileMutation($input: DeleteCustomRecapFileInput!) {
    deleteCustomRecapFile(input: $input) {
      success
      message
      customRecap {
        id
        uuid
        customRecapFiles {
          id
          name
          url
          displayUrl
          approved
          fileRecapCategory {
            name
          }
          fileType {
            name
          }
        }
      }
    }
  }
`;
