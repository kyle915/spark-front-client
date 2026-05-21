import { graphql } from "react-relay";

/**
 * Admin-facing edit path for a custom recap. Reuses the existing
 * updateCustomRecap mutation — the input shape is "replace-set":
 *   - `files`: pass the new full list of files (existing blobs not
 *     in the list get deleted, new blobs get created).
 *   - `customFieldValues`: same upsert-by-customFieldId semantics.
 *   - Booleans, totals, etc. only apply when non-null.
 *
 * Required fields (name, eventId, customRecapTemplateId) must be
 * passed every time — caller threads them from the loaded recap.
 */
export const UpdateCustomRecapMutation = graphql`
  mutation CustomRecapEditMutations_UpdateMutation(
    $input: UpdateCustomRecapInput!
  ) {
    updateCustomRecap(input: $input) {
      success
      message
      customRecap {
        id
        uuid
        name
        totalEngagements
        late
        incomplete
        usedCorpoCard
        approved
      }
    }
  }
`;
