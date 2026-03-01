import { graphql } from "react-relay";

export const RequestUuidQuery = graphql`
  query RequestUuidQuery($uuid: ID!) {
    request(uuid: $uuid) {
      __typename
      id
      uuid
      name
      notes
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
      declineReason
      rmmAsigned {
        id
        uuid
        firstName
        lastName
      }
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
        address
        storeContact
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
      requestorEmail
      createdBy {
        firstName
        lastName
        image {
          url
        }
      }
      approvedBy {
        firstName
        lastName
        image {
          url
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
        slug
      }
      timezone {
        __typename
        id
        uuid
        name
        code
        offset
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
      tenantId
      createdAt
      updatedAt
    }
  }
`;
