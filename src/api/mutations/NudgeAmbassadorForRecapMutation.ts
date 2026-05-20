import { graphql } from "react-relay";

/**
 * Push "you still owe a recap" to a specific BA on a specific event.
 *
 * Returns the device count so the UI can distinguish "Nudged on 2
 * devices" from "BA has no registered devices — try a DM" without a
 * follow-up round-trip. Backend refuses to fire when a recap already
 * exists for the event (avoids embarrassing the admin with a stale
 * nudge).
 */
export const NudgeAmbassadorForRecapMutation = graphql`
  mutation NudgeAmbassadorForRecapMutation(
    $input: NudgeAmbassadorForRecapInput!
  ) {
    nudgeAmbassadorForRecap(input: $input) {
      success
      message
      devicesNotified
    }
  }
`;
