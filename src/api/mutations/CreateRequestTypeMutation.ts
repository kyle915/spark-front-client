import { graphql } from "react-relay";

export const CreateRequestTypeMutation = graphql`
  mutation CreateRequestTypeMutation($input: CreateRequestTypeInput!) {
    createRequestType(input: $input) {
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
