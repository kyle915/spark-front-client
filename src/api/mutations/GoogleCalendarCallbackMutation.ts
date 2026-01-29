import { graphql } from "react-relay";

export const GoogleCalendarCallbackMutation = graphql`
  mutation GoogleCalendarCallbackMutation($input: GoogleCalendarCallbackInput!) {
    googleCalendarCallback(input: $input) {
      success
      message
      clientMutationId
    }
  }
`;

