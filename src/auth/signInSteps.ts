/** Which controls the sign-in form shows. Email link first; the password
 *  is one tap away for people who use one. */
export type SignInMode = "link" | "password";

export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const primaryLabel = (mode: SignInMode, busy: boolean): string => {
  if (mode === "link") return busy ? "Sending…" : "Email me a sign-in link";
  return busy ? "Signing in…" : "Sign in";
};

/** Why the primary button cannot act yet, or null when it can. */
export const blockedReason = (
  mode: SignInMode,
  email: string,
  password: string,
): string | null => {
  if (!email.trim()) return "Enter your email.";
  if (!looksLikeEmail(email)) return "That email does not look right.";
  if (mode === "password" && !password) return "Enter your password.";
  return null;
};
