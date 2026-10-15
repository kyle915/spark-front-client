import { graphql } from "react-relay";

/** Recent punches on one clock link, newest first. */
export const ClockSessionsQuery = graphql`
  query ClockSessionsQuery($linkId: ID!, $limit: Int!) {
    clockSessions(linkId: $linkId, limit: $limit) {
      id
      firstName
      lastName
      email
      market
      address
      timezone
      clockInAt
      clockInGps
      clockInAccuracyM
      clockInMapUrl
      clockOutAt
      clockOutGps
      clockOutAccuracyM
      clockOutMapUrl
      durationMinutes
      sheetSynced
      sheetError
    }
  }
`;
