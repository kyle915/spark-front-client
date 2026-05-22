import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — Magic-link sign-in exchange.
 *
 * The /magic/:token route lands here. We swap the token for a JWT via
 * the public `loginWithMagicToken` mutation, drop the token into the
 * existing auth store (socialLogin path — same JWT shape as tokenAuth),
 * then redirect to the `next` query param or `/`.
 */
export default function MagicLinkExchange() {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const socialLogin = useAuthStore((s) => s.socialLogin);
  const logout = useAuthStore((s) => s.logout);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }
    // Clear any stale session BEFORE the exchange. Otherwise the
    // global Relay env can fire a query with an expired JWT, show
    // "Session expired", and bounce the user out of the magic-link
    // page before our exchange completes.
    try {
      logout();
    } catch {
      // logout is best-effort; if there's nothing to clear, fine.
    }
    (async () => {
      try {
        // No Authorization header — the magic mutation is anonymous,
        // and sending an old JWT can confuse the backend session
        // (gqlauth re-issues tokens fresh on this path).
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
          throw new Error(result?.message ?? "Sign-in failed.");
        }
        await socialLogin(result.token, result.refreshToken ?? "");
        const next = search.get("next") || "/";
        navigate(next, { replace: true });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [token, search, socialLogin, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--spark-bg, #0a0d09)" }}
    >
      <div
        className="max-w-md w-full mx-4 rounded-2xl p-6"
        style={{
          background: "var(--spark-surface, #11140e)",
          border: "1px solid var(--spark-border, #1f2418)",
        }}
      >
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: error ? "var(--spark-orange, #ef5a2a)" : "var(--spark-lime, #c5f546)",
          }}
        >
          {error ? "SIGN-IN FAILED" : "SIGNING YOU IN…"}
        </p>
        <h1
          className="display text-2xl font-bold mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          {error ? "Couldn't sign you in." : "One moment."}
        </h1>
        {error ? (
          <>
            <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              {error}
            </p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-5 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime, #c5f546)",
                color: "#0a0d09",
              }}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
            We're verifying your link and signing you in.
          </p>
        )}
      </div>
    </div>
  );
}
