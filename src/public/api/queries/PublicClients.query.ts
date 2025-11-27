import { graphql } from "react-relay";

export const PublicClientsQuery = graphql`
  query PublicClientsQuery($requestUrlName: String!) {
    publicClients(requestUrlName: $requestUrlName) {
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
