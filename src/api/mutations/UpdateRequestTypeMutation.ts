import { graphql } from "react-relay";

export const UpdateRequestTypeMutation = graphql`
  mutation UpdateRequestTypeMutation($input: UpdateRequestTypeInput!) {
    updateRequestType(input: $input) {
      success
      message
      clientMutationId
      requestType {
        id
        uuid
        name
        tenantId
      }
    }
  }
`;
