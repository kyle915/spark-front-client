import { graphql } from "react-relay";

export const CreateRequestMutation = graphql`
  mutation RequestMutation($input: CreateRequestInput!) {
    createRequest(input: $input) {
      success
      message
      clientMutationId
      request {
        id
        uuid
        name
        date
        startTime
        address
        coordinates
        client {
          id
          uuid
          name
        }
        distributor {
          id
          uuid
          name
        }
        retailer {
          id
          uuid
          name
        }
        requestType {
          id
          uuid
          name
        }
        status {
          id
          uuid
          name
        }
        tenantId
        createdAt
        updatedAt
      }
    }
  }
`;


