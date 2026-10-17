import { graphql } from "react-relay";

/** Explicit Summarize. Returns the cached note when one already exists. */
export const SummarizeRecapMutation = graphql`
  mutation SummarizeRecapMutation($recapId: ID!, $isCustom: Boolean!) {
    summarizeRecap(recapId: $recapId, isCustom: $isCustom) {
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
