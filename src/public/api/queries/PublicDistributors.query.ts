// import { graphql } from "react-relay";

// export const PublicDistributorsQuery = graphql`
//   query PublicDistributorsQuery($requestUrlName: String!) {
//     publicDistributors(requestUrlName: $requestUrlName) {
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

export const PUBLIC_DISTRIBUTORS_QUERY = `
  query PublicDistributorsQuery($requestUrlName: String!) {
    publicDistributors(requestUrlName: $requestUrlName) {
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
