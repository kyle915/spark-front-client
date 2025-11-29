// import { graphql } from "react-relay";

// export const PublicProductTypesQuery = graphql`
//   query PublicProductTypesQuery($requestUrlName: String!) {
//     publicProductTypes(requestUrlName: $requestUrlName) {
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

export const PUBLIC_PRODUCT_TYPES_QUERY = `
  query PublicProductTypesQuery($requestUrlName: String!) {
    publicProductTypes(requestUrlName: $requestUrlName) {
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
