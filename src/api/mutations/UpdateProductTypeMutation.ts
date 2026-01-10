import { graphql } from "react-relay";

export const UpdateProductTypeMutation = graphql`
  mutation UpdateProductTypeMutation($input: UpdateProductTypeInput!) {
    updateProductType(input: $input) {
      success
      message
      clientMutationId
      productType {
        id
        uuid
        name
        tenantId
      }
    }
  }
`;
