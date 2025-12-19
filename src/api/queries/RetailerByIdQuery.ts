import { graphql } from "react-relay";

export const RetailerByIdQuery = graphql`
  query RetailerByIdQuery($uuid: ID!) {
    retailer(uuid: $uuid) {
      id
      uuid
      name
      address
      storeContact
      tenantId
      location {
        id
        name
      }
    }
  }
`;
