import { graphql } from "react-relay";

export const PublicRequestTypeQuery = graphql`
  query PublicRequestTypeQuery($requestUrlName: String!) {
    publicRequestType(requestUrlName: $requestUrlName) {
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
