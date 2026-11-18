import type { ReactNode } from "react";
import { Link } from "react-router";
import { SparkMark } from "@/recap/SparkMark";
import "./signIn.css";

/**
 * The page every signed-out account screen sits on: the Ignite mark up top
 * (a link home), the Spark wordmark, one column for the content, and the
 * footer. Sign in, forgot password, reset password, account verification and
 * the sign-in link landing all use it, so they cannot drift apart.
 *
 * Colours and type come from signIn.css, which carries its own palette and
 * writes nothing onto <html>.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <div className="signin-page">
      <header className="signin-top">
        <a
          className="signin-home"
          href="https://www.igniteproductions.co"
          aria-label="Ignite Productions home"
        >
          <img src="/legal/ignite-full-white.png" alt="Ignite Productions" />
        </a>
      </header>

      <main className="signin-col">
        <div className="signin-intro">
          <span className="signin-mark">
            <SparkMark height={88} />
          </span>
        </div>
        <div className="signin-entry">{children}</div>
        <p className="signin-legal">
          By signing in, you agree to the{" "}
          <Link to="/terms-of-service">Terms of Service</Link> and{" "}
          <Link to="/acceptable-use-policy">Acceptable Use Policy</Link> and
          acknowledge the <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </main>

      <footer className="signin-foot">
        <span>© {year} Ignite Productions LLC</span>
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/terms-of-service">Terms</Link>
      </footer>
    </div>
  );
}
