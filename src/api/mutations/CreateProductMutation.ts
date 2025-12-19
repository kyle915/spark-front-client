import { graphql } from "react-relay";

export const CreateProductMutation = graphql`
  mutation CreateProductMutation($input: CreateProductInput!) {
    createProduct(input: $input) {
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
