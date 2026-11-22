import { graphql } from "react-relay";

/**
 * One store of one brand: visits, totals from approved recaps, products,
 * consumer comments, photos, persistent logistics notes, and a short summary.
 * `staff` is null for anyone who is not Ignite staff. Null when the key is
 * not a store of the brand the viewer may read.
 */
export const StoreProfileQuery = graphql`
  query StoreProfileQuery($tenantId: ID!, $storeKey: String!) {
    storeProfile(tenantId: $tenantId, storeKey: $storeKey) {
      storeKey
      name
      address
      city
      state
      summary
      summarySource
      visitTotal
      logisticsNotes
      logisticsNotesUpdatedAt
      totals {
        visits
        upcoming
        approvedRecaps
        consumers
        unitsSold
        conversion
        averageConsumers
        averageUnitsSold
        firstVisit
        lastVisit
      }
      visits {
        eventId
        eventUuid
        requestUuid
        title
        date
        activationType
        status
        recapUuid
        recapKind
        consumers
        unitsSold
        conversion
      }
      products {
        label
        samples
        sold
      }
      comments {
        text
        kind
        recapUuid
        recapKind
      }
      photos {
        url
        category
        recapUuid
        eventDate
      }
      staff {
        inReview
        people {
          name
          visits
          lastDate
        }
        flags {
          recapUuid
          recapKind
          date
          labels
        }
      }
    }
  }
`;
