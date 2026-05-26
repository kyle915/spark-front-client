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
      }
    }
  }
`;
