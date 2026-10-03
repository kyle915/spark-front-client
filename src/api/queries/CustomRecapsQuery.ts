import { graphql } from "react-relay";

export const GetCustomRecapsQuery = graphql`
  query CustomRecapsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: CustomRecapFiltersInput
    $q: String
  ) {
    customRecaps(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
      q: $q
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
          approved
          approvedAt
          approvedBy {
            firstName
            lastName
            email
          }
          isThirdParty
          excludeFromAggregates
          typedStoreName
          storeMappingStatus
          shareToken
          sharedAt
          event {
            name
            date
          }
          eventDate
          eventAddress
          eventRetailer
          eventState
          ambassador {
            id
            user {
              firstName
              lastName
            }
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
      soldUnits
      consumersSampled
      isDryDemo
      peopleEngaged
      fillingForAmbassador
      late
      incomplete
      approved
      approvedAt
      approvedBy {
        firstName
        lastName
        email
      }
      isThirdParty
      excludeFromAggregates
      typedStoreName
      typedStoreAddress
      storeMappingStatus
      storeSuggestions
      shareToken
      sharedAt
      archivedAt
      archiveReason
      archivedBy {
        firstName
        lastName
        email
      }
      clientSignoffStatus
      clientSignoffComment
      clientSignoffAt
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
        name
      }
      retailer {
        name
      }
      location {
        name
      }
      state {
        name
      }
      customRecapTemplate {
        id
        name
        # sampleQtyLabel / sampleQtyTotalLabel ("Cans sampled") for the
        # Product Samples card and KPI strip.
        layout
        # Tenant scope for FileRecapCategoriesQuery — Evidences upload /
        # "Move to…" must list THIS brand's buckets (e.g. Torch THC
        # "Product Spend"), not a hard-coded Sampling photos / Receipts pair.
        tenant {
          id
        }
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
          name
        }
        fileType {
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
        placeholder
        # Field type (text / number / longtext / image) so the view can
        # render the right control. IMAGE fields get an upload/replace
        # control in inline-edit mode instead of a text input — see
        # RecapCustomView (mirrors SparkRecapCreate's fieldKind()).
        customFieldType {
          name
        }
        # ID of the CustomFieldValue row tying this template field to
        # the recap's submitted value. Needed by the inline-edit save
        # path on RecapCustomView so we can target the right row
        # without having to look it up by (recapId, fieldId).
        customFieldValueId
        recapSection {
          name
        }
      }
    }
  }
`;

/**
 * Existence probe for the legacy /recap/view/:uuid route. Custom-template
 * recaps live on a separate model, so SparkRecapView uses this (id + uuid
 * only) to decide whether to redirect — not the full detail query, which
 * would pull every file + template field just to bounce the user.
 */
export const CustomRecapExistsQuery = graphql`
  query CustomRecapsQueryExistsQuery($uuid: ID) {
    customRecap(uuid: $uuid) {
      id
      uuid
    }
  }
`;
