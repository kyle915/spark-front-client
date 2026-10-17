import { useState } from "react";
import {
  validateRecapComment,
  type RecapCommentItem,
} from "./recapCommentValidation";

/**
 * Client comment/question thread on a shared recap (/r/:token).
 * Tenant-branded via the RecapDocument CSS vars — no Spark ops chrome.
 */
export function RecapComments({
  comments,
  busy,
  error,
  onSubmit,
}: {
  comments: RecapCommentItem[];
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: {
    authorName: string;
    authorEmail: string;
    body: string;
  }) => void;
}) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const problem = validateRecapComment(body);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    onSubmit({ authorName: authorName.trim(), authorEmail: authorEmail.trim(), body: body.trim() });
    setBody("");
  };

  return (
    <section aria-label="Comments and questions" className="spark-card p-5">
      <p
        className="mono text-[10px]"
        style={{ letterSpacing: "0.18em", color: "var(--recap-brand, var(--spark-lime))" }}
      >
        COMMENTS &amp; QUESTIONS
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--recap-muted, #5c6154)" }}>
        Leave a comment or question for the Ignite team about this recap.
      </p>

      {comments.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-xl px-3 py-2"
              style={{ border: "1px solid var(--recap-border, #e2e4d8)" }}
            >
              <p className="text-sm font-semibold">{c.authorName || "Client"}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--recap-text, #14160f)" }}>
                {c.body}
              </p>
              {c.createdAt ? (
                <p className="mono text-[10px] mt-1" style={{ color: "var(--recap-faint, #7a7f70)" }}>
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name (optional)"
          className="rounded-xl px-3 py-2 text-sm"
          style={{
            background: "var(--recap-bg, var(--spark-bg))",
            border: "1px solid var(--recap-border, #e2e4d8)",
            color: "var(--recap-text, #14160f)",
          }}
        />
        <input
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          placeholder="Email for a reply (optional)"
          type="email"
          className="rounded-xl px-3 py-2 text-sm"
          style={{
            background: "var(--recap-bg, var(--spark-bg))",
            border: "1px solid var(--recap-border, #e2e4d8)",
            color: "var(--recap-text, #14160f)",
          }}
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ask a question or leave a comment…"
        rows={3}
        maxLength={2000}
        className="w-full mt-2 rounded-xl px-3 py-2 text-sm"
        style={{
          background: "var(--recap-bg, var(--spark-bg))",
          border: "1px solid var(--recap-border, #e2e4d8)",
          color: "var(--recap-text, #14160f)",
        }}
      />
      {localError || error ? (
        <p className="mt-2 text-sm" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
          {localError || error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{
          background: "var(--recap-brand, var(--spark-lime))",
          color: "var(--recap-brand-ink, #0a0d09)",
        }}
      >
        {busy ? "Posting…" : "Post comment"}
      </button>
    </section>
  );
}
