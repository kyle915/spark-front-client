import { useState } from "react";

/**
 * Admin confirmation modal for removing a job posting from the Jobs board.
 * Calls the deployed `deleteJob` mutation via the raw GraphQL POST path (same
 * pattern as DeleteRequestModal) — no Relay codegen needed.
 *
 * `deleteJob` is a SOFT delete: it stamps Job.deleted_at so the posting drops
 * off the Jobs board (and the BA job board), but the row survives and the
 * parent request/event stay on the Master Tracker. Works for ANY job, even
 * ones with no backing request (bulk-imported / born-approved). To remove the
 * whole gig (incl. the tracker), use the Master Tracker's delete instead.
 */

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
  /** Job Relay id (base64) to delete. */
  jobId: string;
  /** Friendly label (venue · date) shown in the confirm copy. */
  label?: string | null;
  onClose: () => void;
  /** Called after a successful delete — parent closes + refetches. */
  onDeleted?: () => void;
};

type DeleteJobResponse = {
  deleteJob: {
    success: boolean;
    message: string | null;
    jobUuid: string | null;
  };
};

const DELETE_JOB = `
  mutation DeleteJob($input: DeleteJobInput!) {
    deleteJob(input: $input) {
      success
      message
      jobUuid
    }
  }
`;

export default function DeleteJobModal({
  jobId,
  label = null,
  onClose,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await postGql<DeleteJobResponse>(DELETE_JOB, {
        input: { id: jobId },
      });
      const r = data.deleteJob;
      if (r?.success) {
        onDeleted?.();
      } else {
        setError(r?.message || "Couldn't delete this job.");
        setSubmitting(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: "rgba(10,11,13,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md spark-card overflow-hidden"
        style={{ borderRadius: 20 }}
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{ letterSpacing: "0.18em", color: "var(--spark-orange)" }}
          >
            DELETE JOB
          </p>
          <h2 className="display text-xl font-bold">Delete this job?</h2>
          {label && (
            <p
              className="text-sm mt-1 truncate"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {label}
            </p>
          )}
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            It'll be removed from the Jobs board (and the BA app). This is
            recoverable, and the event stays on the Master Tracker — delete it
            there too if you want the whole gig gone.
          </p>
          {error && (
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.14em", color: "var(--spark-orange)" }}
            >
              {error}
            </p>
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
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--spark-orange)", color: "#0a0d09" }}
          >
            {submitting ? "Deleting…" : "Delete job"}
          </button>
        </div>
      </div>
    </div>
  );
}
