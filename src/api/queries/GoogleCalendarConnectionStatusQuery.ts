import { graphql } from "react-relay";

export const GoogleCalendarConnectionStatusQuery = graphql`
  query GoogleCalendarConnectionStatusQuery {
    googleCalendarConnectionStatus {
      isConnected
      isActive
      calendarId
      connectedAt
    }
  }
`;

