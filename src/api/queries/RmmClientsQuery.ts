import { graphql } from "react-relay";

export const RmmClientsQuery = graphql`
  query RmmClientsQuery($tenantId: ID!, $tenantUuid: ID, $q: String) {
    rmmClients(tenantId: $tenantId, tenantUuid: $tenantUuid, q: $q) {
      id
      uuid
      username
      firstName
      lastName
    }
  }
`;
