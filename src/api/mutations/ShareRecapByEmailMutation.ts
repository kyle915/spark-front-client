import { graphql } from "react-relay";

/**
 * Backs the on-platform Share modal (the replacement for the native OS
 * share sheet). The API mints/reuses the signed share token, emails the
 * public client-host /r/:token link to the given recipients, and stamps
 * shared_at. Exactly one of recapId / customRecapId.
 */
export const ShareRecapByEmailMutation = graphql`
  mutation ShareRecapByEmailMutation($input: ShareRecapByEmailInput!) {
    shareRecapByEmail(input: $input) {
      success
      message
      shareUrl
      sentCount
    }
  }
`;
