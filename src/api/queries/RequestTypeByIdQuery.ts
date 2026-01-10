import { graphql } from "react-relay";

export const RequestTypeByIdQuery = graphql`
  query RequestTypeByIdQuery($uuid: ID!) {
    requestType(uuid: $uuid) {
      id
      uuid
      name
      tenantId
    }
  }
`;
