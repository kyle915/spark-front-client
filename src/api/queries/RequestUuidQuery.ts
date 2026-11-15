import { graphql } from "react-relay";

export const RequestUuidQuery = graphql`
  query RequestUuidQuery($uuid: ID!) {
    request(uuid: $uuid) {
      __typename
      id
      uuid
      name
      notes
      baCount
      date
      startTime
      endTime
      address
      market
      coordinates
      schedulingStatus
      isNonActiveProductRequired
      casesToBeShipped
      accountSpendAmount
      eventAssetsNeeded
      loadInTime
      onsitePoc
      additionalTeamDetails
      storeNumber
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
        email
      }
      client {
        __typename
        id
        uuid
        name
        email
      }
      billingEntity {
        id
        uuid
        name
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
        isNational
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
      storeManagers {
        id
        name
        phone
      }
      createdBy {
        firstName
        lastName
        email
        image {
          url
        }
      }
      approvedBy {
        firstName
        lastName
        email
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
      coBrands {
        tenantPk
        tenantName
        products {
          id
          name
        }
      }
      tenantId
      tenant {
        id
        uuid
        slug
      }
      events {
        id
        uuid
        name
        address
        date
        startTime
        endTime
        status {
          id
          name
          slug
        }
        # Only the approved flag stays on the main query: it gates the
        # Cancel-event action in the header, so it must be known
        # synchronously. Everything else about recaps (metrics, files,
        # ambassador, hero) lives in RequestFieldReportsQuery, loaded
        # lazily by the Field Reports section.
        recaps {
          id
          approved
        }
        customRecaps {
          id
          approved
        }
      }
      createdAt
      updatedAt
    }
  }
`;
