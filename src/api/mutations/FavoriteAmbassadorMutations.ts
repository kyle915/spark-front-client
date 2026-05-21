import { graphql } from "react-relay";

export const AddFavoriteAmbassadorMutation = graphql`
  mutation FavoriteAmbassadorMutations_AddMutation(
    $input: AddFavoriteAmbassadorInput!
  ) {
    addFavoriteAmbassador(input: $input) {
      success
      message
    }
  }
`;

export const RemoveFavoriteAmbassadorMutation = graphql`
  mutation FavoriteAmbassadorMutations_RemoveMutation(
    $input: RemoveFavoriteAmbassadorInput!
  ) {
    removeFavoriteAmbassador(input: $input) {
      success
      message
    }
  }
`;
