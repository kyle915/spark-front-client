import { graphql } from "react-relay";

/**
 * Ops reviewer note for one recap detail page. Not used by the recap list.
 * `generateIfMissing` is true only for a Needs-review recap so the first open
 * can cache a summary. Later opens read the cache.
 */
export const RecapReviewerSummaryQuery = graphql`
  query RecapReviewerSummaryQuery(
    $recapId: ID!
    $isCustom: Boolean!
    $generateIfMissing: Boolean!
  ) {
    recapReviewerSummary(
      recapId: $recapId
      isCustom: $isCustom
      generateIfMissing: $generateIfMissing
    ) {
      whatHappened
      followUpQuestion
      cached
      source
      looksOff {
        code
        label
        severity
      }
      feedback {
        themes
        competitorProducts
        objections
        purchaseIntent
        quotes
      }
    }
  }
`;
