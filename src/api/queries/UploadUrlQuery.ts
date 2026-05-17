import { graphql } from "react-relay";

/**
 * Fetches a one-time signed URL from GCS that the browser can PUT a file
 * to directly. Use for recap photo uploads + receipt uploads + any
 * arbitrary user-supplied file that should land in our bucket without
 * round-tripping through Django.
 */
export const UploadUrlQuery = graphql`
  query UploadUrlQuery($filePath: String!, $contentType: String!) {
    getUploadUrl(filePath: $filePath, contentType: $contentType) {
      uploadUrl
      blobName
    }
  }
`;
