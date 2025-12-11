import { graphql } from "react-relay";

export const EventUuidQuery = graphql`
query EventUuidQuery($uuid: ID!) {
    event(uuid: $uuid) {
      __typename
      id
      uuid
      name
      startTime
      endTime
      address
      isNational
      notes
      request {
        __typename
        id
        uuid
        name
        date
        startTime
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
      tenantId
      eventType {
        id
        uuid
        name
      }
      status {
        id
        uuid
        name
      }
    }
  }
`