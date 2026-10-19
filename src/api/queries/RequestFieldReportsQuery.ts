import { graphql } from "react-relay";

/**
 * Field Reports for a request — split out of RequestUuidQuery so the
 * request header / account sections paint without waiting on the
 * recap + recapFiles tree. Loaded lazily (own Suspense) by the
 * Field Reports section of SparkRequestView.
 *
 * Legacy Recap and custom-template CustomRecap have different shapes
 * (recapFiles / productsSold vs heroImageUrl / soldUnits); the panel
 * normalizes both into one row model.
 */
export const RequestFieldReportsQuery = graphql`
  query RequestFieldReportsQuery($uuid: ID!) {
    request(uuid: $uuid) {
      id
      uuid
      events {
        id
        uuid
        name
        date
        startTime
        endTime
        recaps {
          id
          uuid
          name
          approved
          totalEngagements
          productsSold
          recapType
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
        customRecaps {
          id
          uuid
          name
          approved
          totalEngagements
          soldUnits
          consumersSampled
          isDryDemo
          peopleEngaged
          recapType
          excludeFromAggregates
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
  }
`;
