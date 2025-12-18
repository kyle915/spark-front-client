import { graphql } from "react-relay";

export const CreateProductTypeMutation = graphql`
  mutation CreateProductTypeMutation($input: CreateProductTypeInput!) {
    createProductType(input: $input) {
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
