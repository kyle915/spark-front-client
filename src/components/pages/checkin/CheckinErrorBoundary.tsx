import { Component, type ErrorInfo, type ReactNode } from "react";
import { apiOrigin, flushQueuedRecap } from "./checkinHelpers";
import { card, helperText, primaryBtn, secondaryBtn, wrap } from "./checkinStyles";
import { checkinCodeFromPath, crashScreenCopy, readSavedOnPhone } from "./draftRecovery";
import { reportFieldIssue } from "./fieldIssues";

/**
 * The field app's last line of defence: no white screen, ever.
 *
 * PublicFieldApp had no error boundary, so any throw while rendering the
 * check-in page — or a lazy chunk that failed to download on one bar of
 * signal — unmounted the whole tree and left a blank page. A BA mid-recap
 * reads that as "everything I typed is gone" and starts over.
 *
 * The draft, photos and any queued recap are on the device either way. This
 * says so, and offers Send now (for a queued recap) and Try again (reload,
 * which reopens the form from the draft). It also leaves staff a trace.
 */
type Props = { children: ReactNode; pathname?: string };
type State = { error: Error | null; sending: boolean; note: string | null };

const ACCENT = "#C4D82E";

export function crashDetail(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const msg = error instanceof Error ? error.message : String(error);
  return `${name}: ${msg}`.slice(0, 160);
}

export default class CheckinErrorBoundary extends Component<Props, State> {
  state: State = { error: null, sending: false, note: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  private code(): string {
    const path =
      this.props.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    return checkinCodeFromPath(path);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CheckinErrorBoundary]", error, info);
    const code = this.code();
    if (code) {
      reportFieldIssue({ origin: apiOrigin(), code, kind: "page_crashed", detail: crashDetail(error) });
    }
  }

  private sendNow = async () => {
    const code = this.code();
    if (!code) return;
    this.setState({ sending: true, note: null });
    let result: string = "retry";
    try {
      result = await flushQueuedRecap(code);
    } catch {
      result = "retry";
    }
    if (result === "flushed" || result === "already") {
      this.setState({ sending: false, note: "Sent. Your recap is in — thank you." });
      return;
    }
    this.setState({
      sending: false,
      note:
        result === "rejected"
          ? "It couldn't be sent yet. Tap Try again to open it and see why."
          : "Still no signal. It's safe on this phone — we'll keep trying.",
    });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const code = this.code();
    const saved = readSavedOnPhone(code);
    const copy = crashScreenCopy(saved);
    return (
      <div style={{ ...wrap, background: "#faf7f1", minHeight: "100dvh" }} role="alert">
        <div style={{ ...card, marginTop: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1c1917" }}>
            {copy.title}
          </h1>
          <p style={{ ...helperText, fontSize: 15, marginTop: 10, color: "#44403c" }}>
            {copy.body}
          </p>
          {this.state.note ? (
            <p style={{ fontSize: 14, marginTop: 10, color: "#1c1917" }} aria-live="polite">
              {this.state.note}
            </p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {saved.queuedRecap ? (
              <button
                type="button"
                style={primaryBtn(ACCENT)}
                disabled={this.state.sending}
                onClick={() => void this.sendNow()}
              >
                {this.state.sending ? "Sending…" : "Send now"}
              </button>
            ) : null}
            <button
              type="button"
              style={saved.queuedRecap ? { ...secondaryBtn, width: "100%" } : primaryBtn(ACCENT)}
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
