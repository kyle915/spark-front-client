import { graphql } from "react-relay";

/**
 * All star ratings left for one BA, newest first. Visibility is enforced
 * server-side: Ignite admins see every rating; a client sees only the
 * ratings they themselves submitted (client ratings stay private to
 * Ignite, never shown to other clients).
 */
export const AmbassadorRatingsQuery = graphql`
  query AmbassadorRatingsQuery($ambassadorId: ID!) {
    ambassadorRatings(ambassadorId: $ambassadorId) {
      id
      uuid
      score
      comment
      byClient
      eventId
      raterName
      createdAt
    }
  }
`;
