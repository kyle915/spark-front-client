import { Component, type ErrorInfo, type ReactNode } from "react";
import { isGuardrailError } from "@/api/relay/guardrailErrors";

interface Props {
  children: ReactNode;
  // Optional replacement UI rendered on error instead of the default
  // full-page card. Used e.g. to keep the sidebar nav usable (without
  // badge counts) if the counts query fails, rather than blanking it.
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary for the page content area.
 *
 * Without this, a single failed query (e.g. a permission error on a
 * sub-query like UsersQuery) throws during render and — with no boundary
 * above it — React unmounts the whole tree, so the screen goes black.
 *
 * This catches the throw, keeps the Spark chrome (sidebar + topbar) up,
 * and shows a readable panel with Try-again / Reload. Layout remounts it
 * per route via `key={pathname}`, so navigating to a working page clears
 * a stuck error automatically.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The page no longer black-screens, so the console is the only signal
    // we'd otherwise keep. Log it for debugging.
    console.error("[ErrorBoundary] caught render error:", error, info);
  }

  private handleRetry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Caller-supplied degraded UI (e.g. sidebar nav without counts).
    if (this.props.fallback !== undefined) return this.props.fallback;

    const message = error.message || "Unknown error";
    // A rate limit or "too large" refusal: the page is fine, it just has to
    // wait. Say so in the server's words, without the debug line.
    const isGuardrail = isGuardrailError(error);
    const isPermission = !isGuardrail && /permission/i.test(message);

    return (
      <div
        className="spark-card p-10 max-w-2xl mx-auto text-center"
        style={{ marginTop: "4vh" }}
      >
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-orange)" }}
        >
          SOMETHING WENT WRONG
        </p>
        <h1
          className="display text-3xl font-bold mt-3"
          style={{ letterSpacing: "-0.03em" }}
        >
          {isGuardrail
            ? "Spark needs a moment."
            : isPermission
              ? "You don't have access to this section."
              : "This section couldn't load."}
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--spark-text-secondary)" }}>
          {isGuardrail
            ? message
            : isPermission
              ? "If you think this is a mistake, ping the Ignite team — the rest of the app still works."
              : "The rest of the app is still up. Try again, or reload the page."}
        </p>
        {isGuardrail ? null : (
          <p
            className="mono text-[11px] mt-4 break-words"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {message.slice(0, 300)}
          </p>
        )}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-sm"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
