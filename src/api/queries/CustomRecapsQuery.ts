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
          # PERF: the list cards only need four numbers, computed
          # server-side, instead of every product sample / sale / file /
          # field value per recap. Shipping all that across thousands of
          # rows is what made the Recaps list slow. The detail query below
          # still fetches the full arrays.
          soldUnits
          consumersSampled
          heroImageUrl
          customRecapFilesCount
          # Export-only scalars (Copy-for-Sheets / CSV). accountSpend sums
          # the recap's account/corporate-card spend field(s); baDisplayName
          # is the typed external BA name or a BA-naming custom field, used
          # only when there's no LINKED ambassador (preferred above).
          accountSpend
          baDisplayName
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
      # Linked-event location, walked server-side from the recap's event
      # (and its request/retailer/location/state). The recap's own
      # retailer/location/state FKs are usually null on custom recaps, so
      # these power the Information panel's Address / Venue / Retailer /
      # City / State / Event Date rows — enough for a client to locate
      # where the activation happened.
      eventDate
      eventAddress
      eventVenue
      eventRetailer
      eventCity
      eventState
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
      externalBaName
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
        # Browser-renderable URL: server-converted .jpg sibling for HEIC
        # uploads (plain img, no in-browser decode or CORS), otherwise
        # equal to the url field.
        displayUrl
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
        # Admin-defined allowed choices for select / multiselect fields
        # (empty for every other field type). RecapCustomView renders the
        # submitted value against these (single string vs JSON array).
        options
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
