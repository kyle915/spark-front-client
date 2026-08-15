import { graphql } from "react-relay";

/**
 * Move one custom-recap file into a different section (FileRecapCategory).
 *
 * Lets an admin re-file a clumped/miscategorized image from the recap view —
 * e.g. drop a receipt the Connecteam import left "Uncategorized" into the
 * tenant's Receipts section — without deleting + re-uploading. The recap view
 * groups files by `fileRecapCategory.name`, so the file re-groups as soon as
 * the refreshed list comes back.
 *
 * `fileRecapCategoryId` accepts a real id, a category name/slug
 * ("Sampling photos" / "Receipts"), the legacy positional sentinels
 * "1"/"2" (mobile), or null to clear (back to Uncategorized).
 *
 * Returns the FULL customRecapFiles list so Relay merges it by custom recap
 * id; selection mirrors GetCustomRecapQuery so the merge is complete.
 */
export const SetCustomRecapFileCategoryMutation = graphql`
  mutation SetCustomRecapFileCategoryMutation(
    $input: SetCustomRecapFileCategoryInput!
  ) {
    setCustomRecapFileCategory(input: $input) {
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
