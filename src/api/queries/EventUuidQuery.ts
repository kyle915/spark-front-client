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
        endTime
        address
        market
        coordinates
        notes
        declineReason
        schedulingStatus
        isNonActiveProductRequired
        casesToBeShipped
        accountSpendAmount
        eventAssetsNeeded
        loadInTime
        onsitePoc
        additionalTeamDetails
        storeNumber
        requestorEmail
        clientName
        clientEmail
        distributorName
        distributorEmail
        retailerName
        retailerAddress
        retailerStoreContact
        storeManagerName
        storeManagerPhone
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
          email
        }
        billingEntity {
          id
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
          address
          storeContact
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
        storeManagers {
          id
          name
          phone
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
        rmmAsigned {
          id
          uuid
          firstName
          lastName
          email
        }
        createdBy {
          firstName
          lastName
          email
        }
        approvedBy {
          firstName
          lastName
          email
        }
        recapsFiledCount
        recapEventUuid
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
      # Custom-template recaps filed against this event. The Master Tracker
      # counts these toward the "● n RECAP" chip, so the detail view must
      # render them too — otherwise a recap the list counted is invisible
      # here. CustomRecap has a different shape than Recap (heroImageUrl /
      # soldUnits instead of recapFiles / productsSold), so the view
      # normalizes both into one card model.
      customRecaps {
        id
        uuid
        name
        approved
        totalEngagements
        soldUnits
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
  }
`;
