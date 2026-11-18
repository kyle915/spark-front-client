import { graphql } from "react-relay";

/**
 * Searchable recap photos (spark-api photo_library). Brand users get their
 * own approved recaps only; receipts are never returned.
 */
export const PhotoLibraryQuery = graphql`
  query PhotoLibraryQuery(
    $tenantId: ID!
    $filters: PhotoLibraryFilterInput
    $first: Int!
    $offset: Int!
  ) {
    photoLibrary(tenantId: $tenantId, filters: $filters, first: $first, offset: $offset) {
      total
      inScope
      tagged
      states
      approvedOnly
      products {
        key
        label
      }
      showOptions {
        key
        label
      }
      crowdOptions {
        key
        label
      }
      settingOptions {
        key
        label
      }
      photos {
        id
        url
        caption
        category
        shows
        showLabels
        crowdSize
        crowdLabel
        setting
        settingLabel
        peoplePresent
        qualityScore
        issues
        products
        store
        city
        state
        eventDate
        recapUuid
        isPick
        approved
        tagged
      }
    }
  }
`;

/** Typed words → library filters. The server checks every value. */
export const InterpretPhotoSearchQuery = graphql`
  query PhotoLibraryQueryInterpretQuery($tenantId: ID!, $text: String!) {
    interpretPhotoSearch(tenantId: $tenantId, text: $text) {
      ok
      reason
      chips
      filters {
        text
        shows
        crowdSizes
        settings
        productIds
        store
        states
        startDate
        endDate
        minQuality
        peoplePresent
        hideIssues
        sort
      }
    }
  }
`;

export default PhotoLibraryQuery;
