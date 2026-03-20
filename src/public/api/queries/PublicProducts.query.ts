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
  query PublicProductsQuery(
    $requestUrlName: String!
    $first: Int = 9
    $after: String
    $filters: ProductFiltersInput
  ) {
    publicProducts(
      requestUrlName: $requestUrlName
      first: $first
      after: $after
      filters: $filters
    ) {
      totalCount
      edges {
        cursor
        node {
          id
          uuid
          name
          image
          tenantId
          productType {
            id
            name
            uuid
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
