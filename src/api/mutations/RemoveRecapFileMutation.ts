import { graphql } from "react-relay";

/**
 * Remove one photo/receipt from a recap (deletes the file row + its GCS
 * blob). Returns the parent recap with the refreshed recapFiles list so
 * Relay merges by recap id and the Files grid re-renders without a
 * reload. Admin-only in the UI; the mutation is auth-gated server-side.
 */
export const RemoveRecapFileMutation = graphql`
  mutation RemoveRecapFileMutation($input: RemoveRecapFileInput!) {
    removeRecapFile(input: $input) {
      success
      message
      recap {
        id
        uuid
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
