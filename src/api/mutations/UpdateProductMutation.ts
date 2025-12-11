import { graphql } from "react-relay";

export const UpdateProductMutation = graphql`
  mutation UpdateProductMutation($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      success
      message
      clientMutationId
      product {
        id
        uuid
        name
        image
        productType {
          id
          name
        }
        tenantId
        createdAt
        updatedAt
      }
    }
  }
`;
