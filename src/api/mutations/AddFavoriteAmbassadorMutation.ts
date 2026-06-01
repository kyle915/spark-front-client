import { graphql } from "react-relay";

/**
 * Star a BA — adds a tenant-scoped favorite row. The op is idempotent
 * server-side (re-starring an already-favorited BA is a no-op success).
 *
 * relay-compiler requires the operation name to start with the module
 * name, so this is `AddFavoriteAmbassadorMutation` (the prior attempt's
 * `FavoriteAmbassadorMutations_AddMutation` artifact came from a single
 * combined module and is superseded here).
 */
export const AddFavoriteAmbassadorMutation = graphql`
  mutation AddFavoriteAmbassadorMutation(
    $input: AddFavoriteAmbassadorInput!
  ) {
    addFavoriteAmbassador(input: $input) {
      success
      message
    }
  }
`;
