import { useState } from "react";
import { Link, useNavigate } from "react-router";
import SparkLoginCreative from "@/auth/SparkLoginCreative";

/**
 * /forgot-password — BA enters their email, we POST to
 * `requestPasswordReset` (Cloud Run mutation, deployed in
 * spark-api fix/recap-files-resolver branch), backend emails a
 * one-click reset link to /reset-password/<token>. Anti-enumeration
 * success-state regardless of whether the email matches.
 *
 * Layout mirrors /login: dark Spark v2 left form panel + the
 * SparkLoginCreative right panel for visual continuity.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email required.");
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
              Forgot password
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
                marginBottom: 12,
                lineHeight: 1.1,
              }}
            >
              Reset your password.
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "rgba(245,242,236,0.65)",
                textAlign: "center",
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              Enter the email tied to your Spark account. We'll send you a
              one-click link to set a new password.
            </p>

            {sent ? (
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
                  CHECK YOUR INBOX
                </p>
                <p
                  style={{
                    fontSize: 14,
                    color: "rgba(245,242,236,0.8)",
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  If an account exists for <strong>{email.trim()}</strong>,
                  you'll get a reset link in the next few minutes. Tap it on
                  this device to set a new password. Check spam if it doesn't
                  show.
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="btn btn-primary mt-4"
                  style={{ width: "100%", borderRadius: 999 }}
                >
                  Back to sign in →
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Your Email</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  {busy ? "Sending…" : "Send reset link →"}
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
