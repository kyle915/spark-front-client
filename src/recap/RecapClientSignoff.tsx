import { useState } from "react";

export type SignoffStatus = "looks_good" | "need_more_photos" | "";

export function RecapClientSignoff({
  existingStatus,
  existingComment,
  existingAt,
  busy,
  onSubmit,
}: {
  existingStatus?: SignoffStatus | string | null;
  existingComment?: string | null;
  existingAt?: string | null;
  busy?: boolean;
  onSubmit: (status: "looks_good" | "need_more_photos", comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const done = existingStatus === "looks_good" || existingStatus === "need_more_photos";
  const label =
    existingStatus === "looks_good"
      ? "Looks good"
      : existingStatus === "need_more_photos"
        ? "Need more photos"
        : null;

  if (done) {
    return (
      <div
        className="spark-card p-5"
        style={{ borderColor: "color-mix(in srgb, var(--recap-brand, #c5f546) 40%, transparent)" }}
      >
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--recap-brand, var(--spark-lime))" }}
        >
          CLIENT SIGN-OFF
        </p>
        <p className="mt-2 text-sm font-semibold">{label}</p>
        {existingStatus === "need_more_photos" ? (
          <p
            className="mt-2 text-sm"
            style={{
              color: "color-mix(in srgb, var(--recap-text, #f2f3ee) 75%, transparent)",
            }}
          >
            We sent this to the ambassador.
          </p>
        ) : null}
        {existingComment ? (
          <p className="mt-1 text-sm" style={{ color: "var(--recap-muted, #5c6154)" }}>
            “{existingComment}”
          </p>
        ) : null}
        {existingAt ? (
          <p className="mono text-[10px] mt-2" style={{ color: "var(--recap-faint, #7a7f70)" }}>
            {new Date(existingAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="spark-card p-5">
      <p
        className="mono text-[10px]"
        style={{ letterSpacing: "0.18em", color: "var(--recap-brand, var(--spark-lime))" }}
      >
        YOUR SIGN-OFF
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--recap-muted, #5c6154)" }}>
        Does this look right?
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional note for the team…"
        rows={3}
        className="w-full mt-3 rounded-xl px-3 py-2 text-sm"
        style={{
          background: "var(--recap-bg, var(--spark-bg))",
          border: "1px solid var(--spark-border, #1f2418)",
          color: "var(--recap-text, var(--spark-text))",
        }}
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSubmit("looks_good", comment)}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{
            background: "var(--recap-brand, var(--spark-lime))",
            color: "var(--recap-brand-ink, #0a0d09)",
          }}
        >
          Looks good
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSubmit("need_more_photos", comment)}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{
            background: "transparent",
            border: "1px solid var(--spark-border, #1f2418)",
            color: "var(--recap-text, var(--spark-text))",
          }}
        >
          Need more photos
        </button>
      </div>
    </div>
  );
}
