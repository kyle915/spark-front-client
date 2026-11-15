import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAlertStore } from "@store/alertStore";
import { useAuthStore } from "@store/authStore";
import { GoogleButton } from "@auth/components/GoogleButton";
import { requestMagicLink } from "@/auth/MagicLinkButton";
import { themes } from "@/utils";
import { blockedReason, primaryLabel, type SignInMode } from "./signInSteps";
import { playArrival } from "./arrivalSweep";
import { AuthShell } from "./AuthShell";

/**
 * Sign in. A light form beside a dark brand panel.
 *
 * The easiest way in leads: type an email, get a one-click link. A password
 * is one tap away, and Google sits below. The page carries its own colours
 * (signIn.css) and writes nothing onto <html> that the app then has to undo.
 */

const Login = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();
  const { showAlert } = useAlertStore();
  const [mode, setMode] = useState<SignInMode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // Select the stylesheet's Spark theme (the app reads these two keys on
    // start-up). No inline colours: those used to follow people into the app.
    document.documentElement.setAttribute("color-scheme", "dark");
    document.documentElement.setAttribute("data-theme", themes.dark);
    try {
      localStorage.setItem("@color-scheme", "dark");
      localStorage.setItem("@theme", themes.dark);
    } catch {
      /* private mode: the attributes above still apply for this visit */
    }
  }, []);

  const busy = sending || loading;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const blocked = blockedReason(mode, email, password);
    setProblem(blocked);
    if (blocked || busy) return;

    if (mode === "password") {
      try {
        await login(email.trim(), password);
        void playArrival(() => navigate("/"));
      } catch (error: unknown) {
        setProblem(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    setSending(true);
    try {
      await requestMagicLink(email);
      setSentTo(email.trim());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showAlert(`Could not send the link: ${message}`, "error");
    } finally {
      setSending(false);
    }
  };

  const form = (
        <form className="signin-form" onSubmit={submit} noValidate>
          <h1 className="signin-title">Sign in</h1>
          <p className="signin-lede">Enter your email and we will send you a link.</p>

          {sentTo ? (
            <>
              <p className="signin-note" role="status">
                <strong>Check your inbox.</strong> If {sentTo} has a Spark account, a
                sign-in link is on its way. It works for 30 minutes.
              </p>
              <button
                type="button"
                className="signin-link signin-center"
                onClick={() => setSentTo(null)}
              >
                Use a different email
              </button>
            </>
          ) : (
            <>
              <div className="signin-field">
                <label className="signin-label" htmlFor="signin-email">
                  Email
                </label>
                <input
                  id="signin-email"
                  className="signin-input"
                  type="email"
                  name="username"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              {mode === "password" ? (
                <div className="signin-field">
                  <div className="signin-label-row">
                    <label className="signin-label" htmlFor="signin-password">
                      Password
                    </label>
                    <Link to="/forgot-password" className="signin-link">
                      Forgot it?
                    </Link>
                  </div>
                  <input
                    id="signin-password"
                    className="signin-input"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              ) : null}

              {problem ? (
                <p className="signin-error" role="alert">
                  {problem}
                </p>
              ) : null}

              <button type="submit" className="signin-primary" disabled={busy}>
                {primaryLabel(mode, busy)}
              </button>

              <button
                type="button"
                className="signin-link signin-center"
                onClick={() => {
                  setProblem(null);
                  setMode(mode === "link" ? "password" : "link");
                }}
              >
                {mode === "link" ? "Use a password instead" : "Email me a link instead"}
              </button>

              <div className="signin-or">or</div>
              <div className="signin-google">
                <GoogleButton isLogin />
              </div>
            </>
          )}

        </form>
  );

  const shiftNote = (
    <p className="signin-shift">
      <strong>Working a shift?</strong> You do not need to sign in. Use the check-in
      link from your text or email.
    </p>
  );

  return (
    <AuthShell>
      {form}
      {shiftNote}
    </AuthShell>
  );
};

export default Login;
