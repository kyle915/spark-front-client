// import { graphql } from "react-relay";

// export const PublicDistributorsQuery = graphql`
//   query PublicDistributorsQuery($requestUrlName: String!, $filters: DistributorFiltersInput) {
//     publicDistributors(requestUrlName: $requestUrlName, filters: $filters) {
//       edges {
//         node {
//           __typename
//           id
//           uuid
//           name
//           tenantId
//           location {
//             id
//             name
//             state {
//               id
//               name
//             }
//           }
//         }
//       }
//     }
//   }
// `;

export const PUBLIC_DISTRIBUTORS_QUERY = `
  query PublicDistributorsQuery($requestUrlName: String!, $filters: DistributorFiltersInput) {
    publicDistributors(requestUrlName: $requestUrlName, filters: $filters) {
      edges { 
        node {
          id
          uuid
          name
          tenantId
          location {
            id
            name
            state {
              id
              name
            }
          }
        }
      }
    } 
  }
`;
