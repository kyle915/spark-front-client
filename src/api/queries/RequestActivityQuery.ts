import { graphql } from "react-relay";

/** Who did what, when, on one request (newest first; server caps at 200). */
export const RequestActivityQuery = graphql`
  query RequestActivityQuery($uuid: ID) {
    request(uuid: $uuid) {
      id
      activityLog {
        uuid
        kind
        summary
        actorName
        actorEmail
        createdAt
      }
    }
  }
`;
