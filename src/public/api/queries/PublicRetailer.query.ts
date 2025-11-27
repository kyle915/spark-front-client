import { graphql } from "react-relay";

export const PublicRetailerQuery = graphql`
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
