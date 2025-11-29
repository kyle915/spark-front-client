// import { graphql } from "react-relay";

// export const PublicRetailerQuery = graphql`
//   query PublicRetailerQuery($requestUrlName: String!) {
//     publicRetailer(requestUrlName: $requestUrlName) {
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

export const PUBLIC_RETAILER_QUERY = `
  query PublicRetailerQuery($requestUrlName: String!) {
    publicRetailer(requestUrlName: $requestUrlName) {
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
