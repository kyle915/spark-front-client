/** Which sign-in layout to draw. `?v=` picks one while the design is being
 *  chosen; anything else gets the default. */
export type SignInVariant = "poster" | "runsheet" | "quiet";

export const DEFAULT_SIGN_IN_VARIANT: SignInVariant = "poster";

export const signInVariant = (search: string): SignInVariant => {
  const v = new URLSearchParams(search).get("v");
  return v === "poster" || v === "runsheet" || v === "quiet" ? v : DEFAULT_SIGN_IN_VARIANT;
};
