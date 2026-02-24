import { graphql } from "react-relay";

export const DeclineEventMutation = graphql`
  mutation DeclineEventMutation($input: DeclineEventInput!) {
    declineEvent(input: $input) {
      success
      message
      clientMutationId
    }
  }
`;
