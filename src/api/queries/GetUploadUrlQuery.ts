import { graphql } from "react-relay";

export const GetUploadUrlQuery = graphql`
  query GetUploadUrlQuery($filePath: String!, $contentType: String!) {
    getUploadUrl(filePath: $filePath, contentType: $contentType) {
      uploadUrl
      blobName
    }
  }
`;
