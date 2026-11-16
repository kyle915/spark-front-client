import { graphql } from "react-relay";

/**
 * Pin ("pinned") or unpin ("unpinned") one photo as a best photo, or hand
 * the choice back to the scorer (""). Returns the recap's photos.
 */
export const SetRecapPhotoPickMutation = graphql`
  mutation SetRecapPhotoPickMutation($fileId: ID!, $choice: String!) {
    setRecapPhotoPick(fileId: $fileId, choice: $choice) {
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

export default SetRecapPhotoPickMutation;
