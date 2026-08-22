import { graphql } from "react-relay";

/**
 * Backs the Recaps list multi-select Share / Email modal. Bulk sibling
 * of ShareRecapByEmailMutation: the API sends ONE digest email per
 * recipient listing every selected recap's public /r/:token link, and
 * stamps shared_at on each. Caps (mirrored server-side): 25 recaps,
 * 10 recipients.
 */
export const ShareRecapsByEmailMutation = graphql`
  mutation ShareRecapsByEmailMutation($input: ShareRecapsByEmailInput!) {
    shareRecapsByEmail(input: $input) {
      success
      message
      sentCount
      sharedCount
    }
  }
`;
