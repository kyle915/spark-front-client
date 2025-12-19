import { graphql } from "react-relay";

export const DeleteProductMutation = graphql`
  mutation DeleteProductMutation($input: DeleteProductInput!) {
    deleteProduct(input: $input) {
      success
      message
      product {
        id
        uuid
      }
    }
  }
`;
