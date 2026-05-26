import { graphql } from "react-relay";

/**
 * Leave (or update) a 1-5 star rating for a BA, optionally tied to a
 * gig via eventId. Both Ignite admins and clients can rate; the server
 * derives `byClient` from the caller's role. Re-rating the same
 * (ambassador, event) by the same user overwrites the prior row.
 *
 * The response echoes the recomputed BA-level average + count (scoped
 * to what the caller is allowed to see) plus the saved rating row, so
 * the UI can update its stars without a refetch.
 */
export const RateAmbassadorMutation = graphql`
  mutation RateAmbassadorMutation($input: RateAmbassadorInput!) {
    rateAmbassador(input: $input) {
      success
      message
      ambassadorAverage
      ambassadorRatingCount
      ambassadorRating {
        id
        uuid
        score
        comment
        byClient
        ambassadorId
        eventId
        raterName
        createdAt
      }
    }
  }
`;
