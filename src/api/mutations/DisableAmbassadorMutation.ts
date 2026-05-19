import { graphql } from "react-relay";

/**
 * Disable an Ambassador — admin path.
 *
 * Used by the pending-approval queue when a signup looks
 * suspicious or the team doesn't want to onboard the BA. The
 * underlying service sets both Ambassador.is_active and
 * User.is_active to False so the user can no longer sign in.
 */
export const DisableAmbassadorMutation = graphql`
  mutation DisableAmbassadorMutation($input: DisableAmbassadorInput!) {
    disableAmbassador(input: $input) {
      success
      message
      ambassador {
        id
        uuid
        isActive
      }
    }
  }
`;
