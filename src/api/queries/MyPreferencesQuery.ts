import { graphql } from "react-relay";

/**
 * Per-user UI preferences (timezone, currency, enabled activation
 * types). Returns a single opaque `prefs` JSON blob; the backend
 * fills in sensible defaults for any key the user hasn't saved yet,
 * and the Settings page applies its own fallbacks defensively too.
 *
 * Replaces the old @spark.settings.* localStorage reads — the
 * backend is now the source of truth.
 */
export const MyPreferencesQuery = graphql`
  query MyPreferencesQuery {
    myPreferences {
      prefs
    }
  }
`;
