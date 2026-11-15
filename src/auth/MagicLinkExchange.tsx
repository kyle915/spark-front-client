import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { playArrival } from "@/auth/arrivalSweep";
import { AuthShell } from "./AuthShell";
import { failureMessage } from "./authCopy";

/**
 * Spark v2 — Magic-link sign-in exchange.
 *
 * The /magic/:token route lands here. We swap the token for a JWT via
 * the public `loginWithMagicToken` mutation, drop the token into the
 * existing auth store (socialLogin path — same JWT shape as tokenAuth),
 * then redirect to the `next` query param or `/`.
 */
const SIGN_IN_FAILED = "That link did not sign you in.";

export default function MagicLinkExchange() {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const socialLogin = useAuthStore((s) => s.socialLogin);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This sign-in link is incomplete.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              mutation LoginWithMagicToken($input: LoginWithMagicTokenInput!) {
                loginWithMagicToken(input: $input) {
                  success
                  message
                  token
                  refreshToken
                  userId
                  email
                  firstName
                  lastName
                }
              }
            `,
            variables: { input: { token } },
          }),
        });
        const json = (await res.json()) as {
          data?: {
            loginWithMagicToken?: {
              success: boolean;
              message: string;
              token: string | null;
              refreshToken: string | null;
            };
          };
          errors?: Array<{ message: string }>;
        };
        if (json.errors?.length) {
          throw new Error(json.errors.map((e) => e.message).join("; "));
        }
        const result = json.data?.loginWithMagicToken;
        if (!result?.success || !result.token) {
          throw new Error(result?.message || SIGN_IN_FAILED);
        }
        await socialLogin(result.token, result.refreshToken ?? "");
        const next = search.get("next") || "/";
        void playArrival(() => navigate(next, { replace: true }));
      } catch (e) {
        setError(failureMessage(e, SIGN_IN_FAILED));
      }
    })();
  }, [token, search, socialLogin, navigate]);

  return (
    <AuthShell>
      <div className="signin-form">
        {error ? (
          <>
            <h1 className="signin-title">That link did not work</h1>
            <p className="signin-error" role="alert">
              {error}
            </p>
            <p className="signin-lede">
              Sign-in links work for 30 minutes. You can ask for a new one.
            </p>
            <button
              type="button"
              className="signin-primary"
              onClick={() => navigate("/login", { replace: true })}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="signin-title">Signing you in</h1>
            <p className="signin-lede" role="status">
              This takes a moment.
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
