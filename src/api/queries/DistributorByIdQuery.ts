import { graphql } from "react-relay";

export const DistributorByIdQuery = graphql`
  query DistributorByIdQuery($uuid: ID!) {
    distributor(uuid: $uuid) {
      id
      uuid
      name
      email
      tenantId
      location {
        id
        name
      }
    }
  }
`;
