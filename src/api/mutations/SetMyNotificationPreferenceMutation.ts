import { graphql } from "react-relay";

/** Turn one optional email category on or off for the caller only. */
export const SetMyNotificationPreferenceMutation = graphql`
  mutation SetMyNotificationPreferenceMutation(
    $input: SetMyNotificationPreferenceInput!
  ) {
    setMyNotificationPreference(input: $input) {
      success
      message
      category
      emailEnabled
    }
  }
`;

export default SetMyNotificationPreferenceMutation;
