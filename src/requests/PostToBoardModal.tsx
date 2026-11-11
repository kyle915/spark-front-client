import { useState } from "react";

/**
 * Admin modal that posts an event's job to the PUBLIC BA job board so
 * any eligible Brand Ambassador can apply (as opposed to InviteBAModal,
 * which targets a hand-picked BA with a direct shift offer).
 *
 * Calls the already-deployed `postEventToBoard` mutation via the raw
 * GraphQL POST path (no Relay codegen) — same lightweight pattern the
 * bulk-upload flow uses. The admin sets the hourly rate + total hours
 * (which drive what the BA sees + earns) plus optional uniform/notes,
 * then the backend creates the public listing.
 */

// Copied verbatim from SparkBulkUpload.tsx's postGql helper: POSTs to
// the GraphQL endpoint with the JWT from localStorage, parses JSON, and
// throws on a non-empty `errors` array so callers get one clean message.
async function postGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json.data as T;
}

type Props = {
  /** Event ID (Relay base64) whose job should be posted to the board. */
  eventId: string;
  /** Optional friendly label (venue/name) shown in the modal header. */
  eventName?: string | null;
  onClose: () => void;
  /** Optional callback after a successful post — parent can refetch. */
  onPosted?: () => void;
};

type PostEventToBoardResponse = {
  postEventToBoard: {
    success: boolean;
    message: string | null;
    jobUuid: string | null;
    lifecycleStatus: string | null;
  };
};

const POST_EVENT_TO_BOARD = `
  mutation PostEventToBoard($input: PostEventToBoardInput!) {
    postEventToBoard(input: $input) {
      success
      message
      jobUuid
      lifecycleStatus
    }
  }
`;

export default function PostToBoardModal({
  eventId,
  eventName = null,
  onClose,
  onPosted,
}: Props) {
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  // Both numeric fields must parse to a positive, finite number before
  // the primary button enables — mirrors the backend's Float! contract.
  const rateNum = Number(rate);
  const hoursNum = Number(hours);
  const rateValid = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum > 0;
  const hoursValid =
    hours.trim() !== "" && Number.isFinite(hoursNum) && hoursNum > 0;
  const canSubmit = rateValid && hoursValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await postGql<PostEventToBoardResponse>(POST_EVENT_TO_BOARD, {
        input: {
          eventId,
          hourlyRate: Number(rate),
          totalHours: Number(hours),
          uniformNotes: notes.trim() || null,
        },
      });
      const r = data.postEventToBoard;
      if (r?.success) {
        setPosted(true);
        onPosted?.();
      } else {
        setError(r?.message || "Couldn't post this event to the board.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh]"
      style={{
        background: "rgba(var(--spark-bg-rgb),0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg spark-card overflow-hidden"
        style={{ borderRadius: 20, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            POST TO JOB BOARD
          </p>
          <h2 className="display text-xl font-bold">Post to job board</h2>
          {eventName && (
            <p
              className="text-sm mt-1 truncate"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {eventName}
            </p>
          )}
        </div>

        <div className="overflow-y-auto p-5 space-y-4" style={{ flex: 1 }}>
          {posted ? (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(var(--spark-accent-rgb),0.06)",
                border: "1px solid rgba(var(--spark-accent-rgb),0.3)",
              }}
            >
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-lime)",
                }}
              >
                ✓ POSTED
              </p>
              <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
                Posted to the board — eligible BAs can now apply.
              </p>
            </div>
          ) : (
            <>
              <label className="block">
                <span
                  className="mono text-[10px] block mb-1.5"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  HOURLY RATE ($) *
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g. 25"
                  autoFocus
                  className="w-full rounded-xl text-sm"
                  style={{
                    padding: "0.6rem 0.85rem",
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    outline: "none",
                  }}
                />
              </label>

              <label className="block">
                <span
                  className="mono text-[10px] block mb-1.5"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  TOTAL HOURS *
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-full rounded-xl text-sm"
                  style={{
                    padding: "0.6rem 0.85rem",
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    outline: "none",
                  }}
                />
              </label>

              <label className="block">
                <span
                  className="mono text-[10px] block mb-1.5"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  UNIFORM / NOTES
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dress code, parking, what to bring…"
                  rows={3}
                  className="w-full rounded-xl text-sm"
                  style={{
                    padding: "0.6rem 0.85rem",
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </label>

              {error && (
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-orange)",
                  }}
                >
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div
          className="p-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            {posted ? "Close" : "Cancel"}
          </button>
          {!posted && (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                boxShadow: canSubmit
                  ? "0 0 16px rgba(var(--spark-accent-rgb),0.35)"
                  : "none",
              }}
            >
              {submitting
                ? "Posting…"
                : "Post to board — open to all"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
