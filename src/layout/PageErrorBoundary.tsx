/**
 * Minimal page-level error boundary.
 *
 * Wrap any leaf route component to make sure a runtime crash renders
 * a readable error instead of a fully blank page. The app has no
 * top-level ErrorBoundary, so a single throw in a lazy chunk leaves
 * the user staring at black.
 *
 * Use sparingly — at the page/Layout level — so a small widget that
 * throws doesn't take out the whole route.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  err: Error | null;
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    // Console-only — we don't have a remote logger yet.
    // eslint-disable-next-line no-console
    console.error("[PageErrorBoundary]", this.props.label ?? "page", err, info);
  }

  reset = () => this.setState({ err: null });

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--spark-bg, #0a0d09)",
          color: "rgba(255,255,255,0.85)",
          padding: 24,
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "60px auto",
            border: "1px solid rgba(255,90,42,0.45)",
            background: "rgba(239,90,42,0.10)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <p
            style={{
              letterSpacing: "0.18em",
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "monospace",
            }}
          >
            PAGE CRASHED
          </p>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginTop: 6,
              color: "var(--spark-orange, #ef5a2a)",
            }}
          >
            Something broke while loading {this.props.label ?? "this page"}.
          </h1>
          <pre
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.35)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.err.message || String(this.state.err)}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={this.reset}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: "var(--spark-lime, #c5f546)",
                color: "#0a0d09",
                fontWeight: 600,
                fontSize: 13,
                border: 0,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.20)",
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Hard reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
