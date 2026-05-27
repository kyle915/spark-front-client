import { graphql } from "react-relay";

/**
 * Attach one already-uploaded GCS blob to an existing custom recap.
 *
 * Custom-template (Borjomi / Girl Beer) counterpart to
 * AddRecapFileMutation. RecapUploader PUTs the file to GCS via a signed
 * URL, then calls this with the returned blobName to create the
 * CustomRecapFile row server-side. Distinct from updateCustomRecap,
 * which reconciles the entire recap (and would clobber field values if
 * called with a partial input) — this only creates the one file row.
 *
 * Returns the FULL customRecapFiles list so Relay merges it into the
 * store by custom recap id — the photo grid re-renders with the new
 * image immediately, no page reload. Field selection mirrors
 * GetCustomRecapQuery's customRecapFiles so the merge is complete.
 */
export const AddCustomRecapFileMutation = graphql`
  mutation AddCustomRecapFileMutation($input: AddCustomRecapFileInput!) {
    addCustomRecapFile(input: $input) {
      success
      message
      customRecap {
        id
        uuid
        customRecapFiles {
          id
          name
          url
          approved
          fileRecapCategory {
            id
            name
          }
          fileType {
            id
            name
          }
        }
      }
    }
  }
`;
