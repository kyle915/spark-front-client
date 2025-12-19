import { graphql } from "react-relay";

export const EventTypeByIdQuery = graphql`
  query EventTypeByIdQuery($uuid: ID!) {
    eventType(uuid: $uuid) {
      id
      uuid
      name
      isDefault
      tenantId
    }
  }
`;
