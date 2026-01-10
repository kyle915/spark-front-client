import { graphql } from "react-relay";

export const UpdateRetailerMutation = graphql`
  mutation UpdateRetailerMutation($input: UpdateRetailerInput!) {
    updateRetailer(input: $input) {
      success
      message
      clientMutationId
      retailer {
        id
        uuid
        name
        address
        storeContact
        tenantId
        location {
          id
          name
        }
      }
    }
  }
`;
