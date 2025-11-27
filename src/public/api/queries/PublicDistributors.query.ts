import { graphql } from "react-relay";

export const PublicDistributorsQuery = graphql`
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
