// import { graphql } from "react-relay";

// export const PublicRetailerQuery = graphql`
//   query PublicRetailerQuery($requestUrlName: String!, $filters: RetailerFiltersInput, $q: String) {
//     publicRetailers(requestUrlName: $requestUrlName, filters: $filters, q: $q) {
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

export const PUBLIC_RETAILER_QUERY = `
  query PublicRetailerQuery($requestUrlName: String!, $filters: RetailerFiltersInput, $q: String) {
    publicRetailers(requestUrlName: $requestUrlName, filters: $filters, q: $q) {
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
