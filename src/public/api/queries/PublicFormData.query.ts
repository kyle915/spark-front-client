import { graphql } from "react-relay";

export const PublicFormDataQuery = graphql`
  query PublicFormDataQuery($requestUrlName: String!) {
    publicClients(requestUrlName: $requestUrlName) {
      edges {
        node {
          uuid
          name
          tenantId
        }
      }
    }

    publicRequestType(requestUrlName: $requestUrlName) {
      edges {
        node {
          uuid
          name
          tenantId
        }
      }
    }

    publicProducts(requestUrlName: $requestUrlName) {
      edges {
        node {
          uuid
          name
          tenantId
          productType {
            uuid
          }
        }
      }
    }

    publicDistributors(requestUrlName: $requestUrlName) {
      edges {
        node {
          uuid
          name
          tenantId
        }
      }
    }

    publicRetailer(requestUrlName: $requestUrlName) {
      edges {
        node {
          uuid
          name
          tenantId
        }
      }
    }
  }
`;
