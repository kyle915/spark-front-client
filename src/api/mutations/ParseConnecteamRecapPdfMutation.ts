import { graphql } from "react-relay";

/**
 * Read-only Connecteam PDF parse used by the standard recap-build form.
 *
 * Unlike ImportConnecteamRecapPdfMutation (which drafts a CustomRecap
 * against a tenant template), this scrapes the PDF and returns its values
 * mapped onto the legacy form's fields so SparkRecapCreate can pre-fill
 * the numbers grid + free-text sections. Nothing is persisted — the admin
 * reviews/edits the pre-filled form and submits via createRecap.
 */
export const ParseConnecteamRecapPdfMutation = graphql`
  mutation ParseConnecteamRecapPdfMutation(
    $input: ParseConnecteamRecapPdfInput!
  ) {
    parseConnecteamRecapPdf(input: $input) {
      success
      message
      matchedCount
      totalConsumer
      firstTime
      brandAware
      willing
      notWilling
      productsSold
      totalCansSold
      totalPacksSold
      accountSpend
      trafficDescription
      competitivePresence
      quotes
      feedback
      demographics
      positiveStories
      reasonsToDecline
      doDifferently
      accountNotes
      rawPairs {
        label
        value
      }
    }
  }
`;
