import { graphql } from "react-relay";

export const UpdateDistributorMutation = graphql`
  mutation UpdateDistributorMutation($input: UpdateDistributorInput!) {
    updateDistributor(input: $input) {
      success
      message
      clientMutationId
      distributor {
        id
        uuid
        name
        email
        tenantId
        location {
          id
          name
        }
      }
    }
  }
`;
