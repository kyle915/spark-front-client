import { graphql } from "react-relay";

export const DisconnectGoogleCalendarMutation = graphql`
  mutation DisconnectGoogleCalendarMutation($input: DisconnectGoogleCalendarInput!) {
    disconnectGoogleCalendar(input: $input) {
      success
      message
      clientMutationId
    }
  }
`;

