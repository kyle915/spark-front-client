import { useState } from "react";
import { Link } from "react-router";
import { AuthShell } from "./AuthShell";
import { failureMessage } from "./authCopy";

/**
 * /forgot-password — BA enters their email, we POST to
 * `requestPasswordReset` (Cloud Run mutation, deployed in
 * spark-api fix/recap-files-resolver branch), backend emails a
 * one-click reset link to /reset-password/<token>. Anti-enumeration
 * success-state regardless of whether the email matches.
 *
 * Sits on the same page as sign in (AuthShell + signIn.css).
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
              requestPasswordReset(input: $input) {
                success
                message
              }
            }
          `,
          variables: { input: { email: email.trim() } },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) {
        throw new Error(
          json.errors.map((e: { message: string }) => e.message).join("; "),
        );
      }
      setSent(true);
    } catch (e) {
      setError(failureMessage(e, "Could not send the link. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="signin-form">
          <h1 className="signin-title">Check your email</h1>
          <p className="signin-note" role="status">
            If {email.trim()} has a Spark account, a reset link is on its way.
            Look in spam if you do not see it in a few minutes.
          </p>
          <button
            type="button"
            className="signin-link signin-center"
            onClick={() => setSent(false)}
          >
            Use a different email
          </button>
          <Link to="/login" className="signin-link signin-center">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="signin-form" onSubmit={submit}>
          <h1 className="signin-title">Reset your password</h1>
          <p className="signin-lede">
            Enter your email and we'll send a reset link.
          </p>

          <div className="signin-field">
            <label className="signin-label" htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              className="signin-input"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          {error ? (
            <p className="signin-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="signin-primary" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>

          <Link to="/login" className="signin-link signin-center">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
