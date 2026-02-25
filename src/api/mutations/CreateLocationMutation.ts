import { graphql } from "react-relay";

export const CreateLocationMutation = graphql`
  mutation CreateLocationMutation($input: CreateLocationInput!) {
    createLocation(input: $input) {
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
