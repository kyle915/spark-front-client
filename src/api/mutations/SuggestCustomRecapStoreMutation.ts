import { graphql } from "react-relay";

/**
 * Ignite staff only: refresh Places + OpenAI maybe-matches for a 3rd-party
 * typed store. Never auto-maps — admin still confirms via mapCustomRecapStore.
 */
export const SuggestCustomRecapStoreMutation = graphql`
  mutation SuggestCustomRecapStoreMutation($input: SuggestCustomRecapStoreInput!) {
    suggestCustomRecapStore(input: $input) {
      success
      message
      clientMutationId
      customRecap {
        __typename
        id
        uuid
        storeMappingStatus
        storeSuggestions
        retailer {
          id
          name
          address
          isNational
        }
      }
    }
  }
`;
