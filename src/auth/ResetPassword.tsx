import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import SparkLoginCreative from "@/auth/SparkLoginCreative";

/**
 * /reset-password/:token — Set a new password. We POST the token +
 * password pair to `confirmPasswordReset`; backend validates the
 * signature, expiry, and password complexity, then sets the new
 * hash. On success we redirect to /login.
 */
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
      setError("Missing reset token.");
      return;
    }
    if (password1.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password1 !== password2) {
      setError("Passwords don't match.");
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
        throw new Error(result?.message ?? "Couldn't update password.");
      }
      setDone(true);
      window.setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(197,245,70,0.18), transparent 55%), radial-gradient(circle at 80% 90%, rgba(95,184,239,0.10), transparent 55%), #0a0d09",
      }}
    >
      <div
        className="flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden"
        style={{
          background: "#0A0B0D",
          minHeight: 680,
          boxShadow:
            "0 60px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(214,243,95,0.15), 0 0 80px rgba(214,243,95,0.10)",
        }}
      >
        <div
          className="spark-login-form flex flex-col justify-center items-center w-full lg:w-1/2 px-8 sm:px-12 md:px-16 py-10"
          style={{ background: "#0A0B0D", color: "#F5F2EC" }}
        >
          <div className="w-full max-w-sm">
            <img
              src="/legal/spark-logo.png"
              alt="Spark by Ignite"
              style={{
                height: 36,
                width: "auto",
                display: "block",
                margin: "0 auto 20px",
                filter: "invert(1) hue-rotate(180deg)",
              }}
            />
            <p
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: "#D6F35F",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              New Password
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display, sans-serif)",
                fontWeight: 800,
                fontSize: 32,
                letterSpacing: "-0.03em",
                color: "#F5F2EC",
                textAlign: "center",
                marginTop: 6,
                marginBottom: 24,
                lineHeight: 1.1,
              }}
            >
              Set a new password.
            </h1>

            {done ? (
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "rgba(214,243,95,0.08)",
                  border: "1px solid rgba(214,243,95,0.4)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    color: "#D6F35F",
                  }}
                >
                  PASSWORD UPDATED
                </p>
                <p
                  style={{
                    fontSize: 14,
                    color: "rgba(245,242,236,0.8)",
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  You're all set. Redirecting you to sign in…
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">New Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password1}
                    onChange={(e) => setPassword1(e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Confirm Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
                {error && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 11,
                      color: "#FF5A1F",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-primary"
                  style={{ width: "100%", borderRadius: 999 }}
                >
                  {busy ? "Saving…" : "Set new password →"}
                </button>
              </form>
            )}

            <div className="mt-10 text-center">
              <Link
                to="/login"
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: "rgba(245,242,236,0.55)",
                }}
              >
                ← BACK TO SIGN IN
              </Link>
            </div>
          </div>
        </div>

        <SparkLoginCreative colorScheme="dark" onColorScheme={() => {}} />
      </div>
    </div>
  );
}
