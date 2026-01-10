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
    clientName
    clientEmail
    distributorName
    distributorEmail
    retailerName
    retailerAddress
    retailerStoreContact
    storeManagerName
    storeManagerPhone
    client {
      __typename
      id
      uuid
      name
      email
    }
    distributor {
      __typename
      id
      uuid
      name
      email
    }
    retailer {
      __typename
      id
      uuid
      name
      address
      storeContact
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
    timezone {
      __typename
      id
      uuid
      name
      code
      offset
    }
    tenantId
    createdAt
    updatedAt
  }
}
`;
