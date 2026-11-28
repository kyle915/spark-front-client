import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AuthShell } from "./AuthShell";
import { failureMessage, newPasswordProblem } from "./authCopy";
import { PasswordStrengthMeter } from "@/motion/PasswordStrengthMeter";

/**
 * /reset-password/:token — Set a new password. We POST the token +
 * password pair to `confirmPasswordReset`; backend validates the
 * signature, expiry, and password complexity, then sets the new
 * hash. On success we redirect to /login.
 */
const SAVE_FAILED =
  "Could not save your password. The link may have expired.";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("This reset link is incomplete. Ask for a new one.");
      return;
    }
    const problem = newPasswordProblem(password1, password2);
    if (problem) {
      setError(problem);
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
            mutation ConfirmPasswordReset($input: ConfirmPasswordResetInput!) {
              confirmPasswordReset(input: $input) {
                success
                message
              }
            }
          `,
          variables: {
            input: { token, password1, password2 },
          },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) {
        throw new Error(
          json.errors.map((e: { message: string }) => e.message).join("; "),
        );
      }
      const result = json?.data?.confirmPasswordReset;
      if (!result?.success) {
        throw new Error(result?.message || SAVE_FAILED);
      }
      setDone(true);
      window.setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (e) {
      setError(failureMessage(e, SAVE_FAILED));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {done ? (
        <div className="signin-form">
          <h1 className="signin-title">Password updated</h1>
          <p className="signin-note" role="status">
            Your new password is saved. Taking you to sign in.
          </p>
          <Link to="/login" className="signin-link signin-center">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="signin-form" onSubmit={submit}>
          <h1 className="signin-title">Set a new password</h1>
          <p className="signin-lede">Use at least 8 characters.</p>

          <div className="signin-field">
            <label className="signin-label" htmlFor="reset-password">
              New password
            </label>
            <input
              id="reset-password"
              className="signin-input"
              type="password"
              required
              autoComplete="new-password"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
              autoFocus
            />
            <PasswordStrengthMeter password={password1} />
          </div>

          <div className="signin-field">
            <label className="signin-label" htmlFor="reset-password-again">
              Type it again
            </label>
            <input
              id="reset-password-again"
              className="signin-input"
              type="password"
              required
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>

          {error ? (
            <p className="signin-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="signin-primary" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>

          <Link to="/login" className="signin-link signin-center">
            Back to sign in
          </Link>
        </form>
      )}
      {done ? null : (
        <p className="signin-shift">
          <strong>Link not working?</strong> Reset links expire.{" "}
          <Link to="/forgot-password" className="signin-link">
            Send a new one
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
