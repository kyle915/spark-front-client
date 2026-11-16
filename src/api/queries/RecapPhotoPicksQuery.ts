import { graphql } from "react-relay";

/**
 * Best photos on one custom recap: each photo's score, caption and whether
 * it is a pick. Staff only on the server; a stored read, never a model call.
 */
export const RecapPhotoPicksQuery = graphql`
  query RecapPhotoPicksQuery($recapId: ID!) {
    recapPhotoPicks(recapId: $recapId) {
      ok
      reason
      items {
        fileId
        url
        category
        status
        note
        score
        caption
        modelPick
        staffChoice
        isPick
        canPick
      }
    }
  }
`;

export default RecapPhotoPicksQuery;
