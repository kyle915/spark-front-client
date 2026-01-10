import { graphql } from "react-relay";

export const CreateRequestStoreManagerMutation = graphql`
  mutation CreateRequestStoreManagerMutation(
    $input: CreateRequestStoreManagerInput!
  ) {
    createRequestStoreManager(input: $input) {
      success
      message
      requestStoreManager {
        id
        uuid
        name
        phone
        requestId
      }
    }
  }
`;
