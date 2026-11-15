import { graphql } from "react-relay";

/** Put dismissed rows back on Missing Recaps (and every count and reminder). */
export const RestoreMissingRecapsMutation = graphql`
  mutation RestoreMissingRecapsMutation($input: RestoreMissingRecapsInput!) {
    restoreMissingRecaps(input: $input) {
      success
      message
      restoredCount
    }
  }
`;
