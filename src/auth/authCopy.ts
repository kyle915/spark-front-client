/** Words shared by the signed-out account pages (forgot password, reset
 *  password, account verification, sign-in link landing). Kept apart from the
 *  components so the wording can be tested on its own. */

export const OFFLINE_MESSAGE =
  "Could not reach Spark. Check your connection and try again.";

/**
 * What to tell someone when a request fails.
 *
 * A dropped connection surfaces as a TypeError ("Failed to fetch") and a
 * gateway error page as a SyntaxError from parsing it; neither means anything
 * to the person reading it, so both become one plain sentence. Anything the
 * server said on purpose (an expired link, a password it will not accept) is
 * passed through unchanged.
 */
export const failureMessage = (error: unknown, fallback: string): string => {
  if (error instanceof TypeError || error instanceof SyntaxError) {
    return OFFLINE_MESSAGE;
  }
  const said = error instanceof Error ? error.message.trim() : "";
  return said || fallback;
};

export const MIN_PASSWORD_LENGTH = 8;

/** Why a new password cannot be saved yet, or null when it can. */
export const newPasswordProblem = (
  password: string,
  again: string,
): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== again) return "The two passwords do not match.";
  return null;
};
