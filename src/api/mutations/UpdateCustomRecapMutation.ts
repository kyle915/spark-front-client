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
 * productSamples behaves the same way: when the key is provided the
 * resolver deletes-and-recreates the whole set (so the inline editor
 * sends the full list, seeded from the current samples). When the key
 * is OMITTED the resolver leaves samples untouched. The response echoes
 * customRecapProductSample so the read-only "Product Samples" card
 * reflects the saved truth without a hard reload — this is what lets an
 * admin mark sampled products + units on a Connecteam-imported recap
 * (which never had any) and see them stick. Sales performance is still
 * omitted, so it's left untouched.
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
        totalEngagements
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
          # Mirror GetCustomRecapQuery so select/multiselect options and
          # section labels survive an in-place save (not just the value).
          options
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
        # Echo the product samples so the read-only "Product Samples"
        # card on RecapCustomView reflects what was just saved (added,
        # edited, or cleared) without waiting for a page reload.
        customRecapProductSample {
          id
          quantity
          product {
            id
            name
            image
          }
        }
      }
    }
  }
`;
