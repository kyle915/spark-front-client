import { graphql } from "react-relay";

export const CreateRecapMutation = graphql`
  mutation CreateRecapMutation($input: CreateRecapInput!) {
    createRecap(input: $input) {
      success
      message
      clientMutationId
      recap {
        id
        uuid
        name
        eventId
        createdAt
      }
    }
  }
`;
