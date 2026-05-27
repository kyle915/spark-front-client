import { graphql } from "react-relay";

export const EventUuidQuery = graphql`
  query EventUuidQuery($uuid: ID!) {
    event(uuid: $uuid) {
      __typename
      id
      uuid
      name
      date
      coordinates
      startTime
      endTime
      address
      isNational
      notes
      timezone {
        __typename
        id
        uuid
        name
        code
        offset
      }
      location {
        id
      }
      state {
        id
      }
      distributor {
        __typename
        id
        uuid
        name
        location {
          id
          name
          code
          zip
          state {
            id
            name
            code
          }
        }
      }
      retailer {
        __typename
        id
        uuid
        name
        isNational
        location {
          id
          name
          code
          zip
          state {
            id
            name
            code
          }
        }
      }
      rmmAsigned {
        id
        uuid
        firstName
        lastName
      }
      request {
        __typename
        id
        uuid
        name
        date
        startTime
        address
        coordinates
        timezone {
          __typename
          id
          uuid
          name
          code
          offset
        }
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
          location {
            id
            name
            code
            zip
            state {
              id
              name
              code
            }
          }
        }
        retailer {
          __typename
          id
          uuid
          name
          isNational
          location {
            id
            name
            code
            zip
            state {
              id
              name
              code
            }
          }
        }
        products {
          id
          name
          image
          productType {
            id
            name
          }
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
      ambassadors {
        uuid
        name
        email
        isApproved
      }
    }
  }
`;
