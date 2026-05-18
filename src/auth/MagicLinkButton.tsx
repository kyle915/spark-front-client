import { useState } from "react";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — "Email me a sign-in link" button.
 *
 * Sits under the username/password form. Click → BA types email → we
 * hit `requestMagicLink` → backend emails a one-click URL. Anti-
 * enumeration generic success regardless of whether the email is in
 * the DB.
 */
export default function MagicLinkButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const showAlert = useAlertStore((s) => s.showAlert);

  const send = async () => {
    if (!email.trim()) {
      showAlert("Enter your email first.", "warning");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation RequestMagicLink($input: RequestMagicLinkInput!) {
              requestMagicLink(input: $input) {
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
        throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
      }
      setSent(true);
    } catch (e) {
      showAlert(`Couldn't send: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div
        className="mt-6 rounded-xl p-4 text-center"
        style={{
          background: "rgba(197,245,70,0.08)",
          border: "1px solid rgba(197,245,70,0.35)",
        }}
      >
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
        >
          CHECK YOUR INBOX
        </p>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.8)" }}>
          If an account exists for {email.trim()}, we just emailed you a
          one-click sign-in link. It expires in 30 minutes.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full text-center text-sm py-2 transition"
        style={{
          color: "var(--spark-lime)",
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "0.18em",
          fontSize: 11,
        }}
      >
        ✦ EMAIL ME A SIGN-IN LINK INSTEAD
      </button>
    );
  }

  return (
    <div
      className="mt-4 rounded-xl p-4"
      style={{
        background: "var(--spark-surface, #11140e)",
        border: "1px solid var(--spark-border, #1f2418)",
      }}
    >
      <p
        className="mono text-[10px] mb-2"
        style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
      >
        EMAIL ME A SIGN-IN LINK
      </p>
      <input
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      />
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 rounded-lg text-xs"
          style={{
            background: "transparent",
            border: "1px solid var(--spark-border)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={send}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "Sending…" : "Send sign-in link →"}
        </button>
      </div>
    </div>
  );
}
