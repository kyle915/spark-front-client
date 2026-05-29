import { graphql } from "react-relay";

/**
 * Update an existing custom recap. Currently used by the
 * RecapCustomView inline-edit flow to let admins correct submitted
 * field values without having to re-do the whole recap.
 *
 * Backend resolver replaces the entire customFieldValues set when
 * provided — any CustomFieldValue row not present in the input gets
 * deleted. The mobile callers (and now the inline editor) need to
 * send the full list of values, not just the changed ones.
 *
 * Product samples + sales performance are NOT included here so the
 * resolver leaves them untouched (only acts when those keys are
 * explicitly passed).
 */
export const UpdateCustomRecapMutation = graphql`
  mutation UpdateCustomRecapMutation($input: UpdateCustomRecapInput!) {
    updateCustomRecap(input: $input) {
      success
      message
      customRecap {
        id
        uuid
        name
        # Echo back the scalars the inline editor can change so the Relay
        # store reflects the saved truth without a hard reload. Before this,
        # the response omitted usedCorpoCard / ambassador / externalBaName /
        # fillingForAmbassador, so the store kept the stale pre-save values
        # (the "Corporate Card reverts to No" bug) until the page reloaded.
        usedCorpoCard
        fillingForAmbassador
        externalBaName
        ambassador {
          id
          user {
            id
            firstName
            lastName
          }
        }
        customField {
          id
          name
          value
          # Keep the field kind in the store after an in-place save so an
          # IMAGE field stays an image (renders its blob / upload control)
          # instead of reverting to a text input until the next reload.
          customFieldType {
            id
            name
          }
          customFieldValueId
          recapSection {
            id
            name
          }
        }
      }
    }
  }
`;
