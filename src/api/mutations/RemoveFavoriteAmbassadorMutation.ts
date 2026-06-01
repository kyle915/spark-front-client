import { graphql } from "react-relay";

/**
 * Unstar a BA — removes the tenant-scoped favorite row. Idempotent
 * server-side (removing a BA that isn't favorited is a no-op success).
 *
 * relay-compiler requires the operation name to start with the module
 * name, so this is `RemoveFavoriteAmbassadorMutation` (the prior
 * attempt's `FavoriteAmbassadorMutations_RemoveMutation` artifact came
 * from a single combined module and is superseded here).
 */
export const RemoveFavoriteAmbassadorMutation = graphql`
  mutation RemoveFavoriteAmbassadorMutation(
    $input: RemoveFavoriteAmbassadorInput!
  ) {
    removeFavoriteAmbassador(input: $input) {
      success
      message
    }
  }
`;
