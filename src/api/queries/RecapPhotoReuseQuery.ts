import { graphql } from "react-relay";

/**
 * Photo reuse check for one recap. A check, not a score. The admin asks for
 * it from the recap review screen; it is not loaded with the page.
 */
export const RecapPhotoReuseQuery = graphql`
  query RecapPhotoReuseQuery($recapId: ID!, $isCustom: Boolean!) {
    recapPhotoReuse(recapId: $recapId, isCustom: $isCustom) {
      items {
        fileId
        fileUrl
        status
        label
      }
    }
  }
`;
