import { graphql } from "react-relay";

export const ConnectGoogleCalendarMutation = graphql`
  mutation ConnectGoogleCalendarMutation($input: ConnectGoogleCalendarInput!) {
    connectGoogleCalendar(input: $input) {
      success
      message
      authorizationUrl
      state
      clientMutationId
    }
  }
`;

