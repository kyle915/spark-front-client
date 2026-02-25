import { graphql } from "react-relay";

export const UpdateLocationMutation = graphql`
  mutation UpdateLocationMutation($input: UpdateLocationInput!) {
    updateLocation(input: $input) {
      success
      message
      clientMutationId
      location {
        id
        uuid
        name
        code
        zip
      }
    }
  }
`;
