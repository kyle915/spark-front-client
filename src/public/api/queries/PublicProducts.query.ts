import { graphql } from "react-relay";

export const PublicProductsQuery = graphql`
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
