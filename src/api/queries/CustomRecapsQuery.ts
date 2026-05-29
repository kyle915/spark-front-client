import { graphql } from "react-relay";

export const GetCustomRecapsQuery = graphql`
  query CustomRecapsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: CustomRecapFiltersInput
  ) {
    customRecaps(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          id
          uuid
          name
          submittedAt
          createdAt
          totalEngagements
          fillingForAmbassador
          late
          incomplete
          approved
          usedCorpoCard
          event {
            id
            name
            date
          }
          ambassador {
            id
            user {
              firstName
              lastName
            }
          }
          job {
            id
            name
          }
          retailer {
            id
            name
          }
          location {
            id
            name
          }
          state {
            id
            name
          }
          customRecapTemplate {
            id
            name
          }
          customRecapProductSample {
            id
            quantity
            product {
              id
              name
              image
            }
          }
          customRecapSalePerformance {
            id
            price
            product {
              id
              name
              image
            }
            typeOfGood {
              id
              name
            }
          }
          customRecapFiles {
            id
            name
            url
            approved
            fileRecapCategory {
              id
              name
            }
            fileType {
              id
              name
            }
          }
          customField {
            id
            name
            value
            recapSection {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const GetCustomRecapQuery = graphql`
  query CustomRecapsQueryDetailsQuery($uuid: ID) {
    customRecap(uuid: $uuid) {
      id
      uuid
      name
      submittedAt
      createdAt
      totalEngagements
      fillingForAmbassador
      late
      incomplete
      approved
      usedCorpoCard
      event {
        id
        name
        date
      }
      ambassador {
        id
        user {
          firstName
          lastName
        }
      }
      job {
        id
        name
      }
      retailer {
        id
        name
      }
      location {
        id
        name
      }
      state {
        id
        name
      }
      customRecapTemplate {
        id
        name
      }
      customRecapProductSample {
        id
        quantity
        product {
          id
          name
          image
        }
      }
      customRecapSalePerformance {
        id
        price
        product {
          id
          name
          image
        }
        typeOfGood {
          id
          name
        }
      }
      customRecapFiles {
        id
        name
        url
        approved
        fileRecapCategory {
          id
          name
        }
        fileType {
          id
          name
        }
      }
      customField {
        id
        name
        value
        # Field type (text / number / longtext / image) so the view can
        # render the right control. IMAGE fields get an upload/replace
        # control in inline-edit mode instead of a text input — see
        # RecapCustomView (mirrors SparkRecapCreate's fieldKind()).
        customFieldType {
          id
          name
        }
        # ID of the CustomFieldValue row tying this template field to
        # the recap's submitted value. Needed by the inline-edit save
        # path on RecapCustomView so we can target the right row
        # without having to look it up by (recapId, fieldId).
        customFieldValueId
        recapSection {
          id
          name
        }
      }
    }
  }
`;
