import { graphql } from "react-relay";

/**
 * Attach one already-uploaded GCS blob to an existing recap.
 *
 * Used by SparkRecapView's photo/receipt uploader. The uploader PUTs
 * the file to GCS via a signed URL, then calls this with the returned
 * blobName to create the RecapFile row server-side. Distinct from
 * updateRecap, which reconciles the whole recap (and would null out
 * scalar fields like productsSold if called with a partial input) —
 * addRecapFile only creates the one file row, touching nothing else.
 */
export const AddRecapFileMutation = graphql`
  mutation AddRecapFileMutation($input: AddRecapFileInput!) {
    addRecapFile(input: $input) {
      success
      message
      recap {
        id
        uuid
        # Return the FULL file list so Relay merges it into the store
        # by recap id — the Files grid re-renders with the new photo
        # immediately, no page reload. (Nevena: "no new picture visible
        # until I reload the page.") Field selection mirrors RecapQuery's
        # recapFiles so the merge is complete, not partial.
        recapFiles {
          id
          uuid
          name
          approved
          file
          fileTypeId
          fileType {
            id
            name
            extension
          }
          fileRecapCategoryId
          fileRecapCategory {
            id
            name
          }
          createdAt
        }
      }
    }
  }
`;
