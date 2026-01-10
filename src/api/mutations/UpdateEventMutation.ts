import { graphql } from "react-relay";

export const UpdateEventMutation = graphql`
  mutation UpdateEventMutation($input: UpdateEventInput!) {
    updateEvent(input: $input) {
      success
      message
      clientMutationId
    }
  }
`;
