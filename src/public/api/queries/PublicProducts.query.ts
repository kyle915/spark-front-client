// import { graphql } from "react-relay";

// export const PublicProductsQuery = graphql`
//   query PublicProductsQuery($requestUrlName: String!) {
//     publicProducts(requestUrlName: $requestUrlName) {
//       edges {
//         node {
//           __typename
//           id
//           uuid
//           name
//           tenantId
//           productType {
//             __typename
//             id
//             name
//             uuid
//           }
//         }
//       }
//     }
//   }
// `;

export const PUBLIC_PRODUCTS_QUERY = `
  query PublicProductsQuery($requestUrlName: String!) {
    publicProducts(requestUrlName: $requestUrlName) {
      edges {
        node {
          id
          uuid
          name
          tenantId
          productType {
            id
            name
            uuid
          }
        }
      } 
    }
  }
`;
