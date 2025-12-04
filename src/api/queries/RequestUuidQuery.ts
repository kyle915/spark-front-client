import { graphql } from "react-relay";

export const RequestUuidQuery = graphql`
query RequestUuidQuery($uuid: ID!) {
  request(uuid: $uuid) {
    __typename
    id
    uuid
    name
    date
    startTime
    endTime
    address
    coordinates
    client {
      __typename
      id
      uuid
      name
    }
    distributor {
      __typename
      id
      uuid
      name
    }
    retailer {
      __typename
      id
      uuid
      name
    }
    requestType {
      __typename
      id
      uuid
      name
    }
    status {
      __typename
      id
      uuid
      name
    }
    tenantId
    createdAt
    updatedAt
  }
}
`;