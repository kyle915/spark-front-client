import { graphql } from "react-relay";

/**
 * The highlight for a brand and a "YYYY-MM" month: a best store, a quote
 * and a photo, picked by rule from approved recaps. Null when the month
 * has too little to show.
 */
export const MonthHighlightQuery = graphql`
  query MonthHighlightQuery($tenantId: ID!, $month: String!) {
    monthHighlight(tenantId: $tenantId, month: $month) {
      month
      label
      caption
      captionSource
      recaps
      store {
        storeKey
        name
        market
        conversion
        consumers
        unitsSold
        recaps
        recapUuid
        recapKind
      }
      quote {
        text
        recapUuid
        recapKind
      }
      photo {
        url
        category
        recapUuid
      }
    }
  }
`;
