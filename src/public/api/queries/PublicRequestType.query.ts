// import { graphql } from "react-relay";

// export const PublicRequestTypeQuery = graphql`
//   query PublicRequestTypeQuery($requestUrlName: String!) {
//     publicRequestType(requestUrlName: $requestUrlName) {
//       edges {
//         node {
//           __typename
//           id
//           uuid
//           name
//           tenantId
//         }
//       }
//     }
//   }
// `;

export const PUBLIC_REQUEST_TYPES_QUERY = `
  query PublicRequestTypeQuery($requestUrlName: String!) {
    publicRequestType(requestUrlName: $requestUrlName) {
      edges {
        node {
          id
          uuid
          name
          tenantId
        }
      }
    }
  }
`;
