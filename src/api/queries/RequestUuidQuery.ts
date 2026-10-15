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
        recaps {
          id
          uuid
          name
          approved
          totalEngagements
          productsSold
          totalCansSold
          createdAt
          ambassador {
            id
            uuid
            user {
              id
              firstName
              lastName
            }
          }
          recapFiles {
            id
            file
            fileType {
              id
              name
              extension
            }
          }
        }
        # Custom-template recaps for this event. Field Reports must show
        # these alongside legacy recaps so the panel matches the count the
        # Master Tracker chip reported. CustomRecap has a different shape
        # (heroImageUrl / soldUnits vs recapFiles / productsSold); the
        # panel normalizes both into one row model.
        customRecaps {
          id
          uuid
          name
          approved
          totalEngagements
          soldUnits
          isDryDemo
          peopleEngaged
          excludeFromAggregates
          createdAt
          heroImageUrl
          customRecapFilesCount
          ambassador {
            id
            uuid
            user {
              id
              firstName
              lastName
            }
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`;
