import { graphql } from "react-relay";

/**
 * Persist per-user UI preferences. The backend does a shallow
 * partial-merge on `prefs`, so callers can save a single key at a
 * time (e.g. just `timezone`) without clobbering the others.
 *
 * Returns the merged `preferences.prefs` so the Relay store stays in
 * sync after each save.
 */
export const SetMyPreferencesMutation = graphql`
  mutation SetMyPreferencesMutation($input: SetMyPreferencesInput!) {
    setMyPreferences(input: $input) {
      success
      message
      preferences {
        prefs
      }
    }
  }
`;
