import { useState } from "react";
import { HoldToConfirmButton } from "@/motion/ConfirmGestures";
import { CodeShakeBox } from "@/motion/CopyMorphButton";

/**
 * Admin confirmation modal for deleting a gig/request from the Master
 * Tracker. Calls the already-deployed `deleteRequest` mutation via the raw
 * GraphQL POST path (same lightweight pattern as PostToBoardModal) — no Relay
 * codegen needed.
 *
 * The backend `deleteRequest` is a SOFT delete: it stamps `deleted_at` so the
 * request drops off the tracker, detail pages, and exports, but the row and
 * its FK-linked events / recaps survive in the DB (an admin can restore it by
 * NULLing `deleted_at`). We surface that "recoverable" framing in the copy so
 * the action reads as reversible, not catastrophic.
 */

// Copied verbatim from PostToBoardModal / SparkBulkUpload's postGql helper.
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
  /** Request ID (Relay base64) to delete. */
  requestId: string;
  /** Friendly label (venue · date) shown in the confirm copy. */
  label?: string | null;
  onClose: () => void;
  /** Called after a successful delete — parent closes + refetches. */
  onDeleted?: () => void;
};

type DeleteRequestResponse = {
  deleteRequest: {
    success: boolean;
    message: string | null;
    deletedRequestUuid: string | null;
  };
};

const DELETE_REQUEST = `
  mutation DeleteRequest($input: DeleteRequestInput!) {
    deleteRequest(input: $input) {
      success
      message
      deletedRequestUuid
    }
  }
`;

export default function DeleteRequestModal({
  requestId,
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
      const data = await postGql<DeleteRequestResponse>(DELETE_REQUEST, {
        input: { id: requestId },
      });
      const r = data.deleteRequest;
      if (r?.success) {
        onDeleted?.();
      } else {
        setError(r?.message || "Couldn't delete this gig.");
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
      style={{
        background: "rgba(var(--spark-bg-rgb),0.7)",
        backdropFilter: "blur(8px)",
      }}
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
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-orange)",
            }}
          >
            DELETE GIG
          </p>
          <h2 className="display text-xl font-bold">Delete this gig?</h2>
          {label && (
            <p
              className="text-sm mt-1 truncate"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {label}
            </p>
          )}
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            It'll be removed from the tracker, lists, and exports. This is
            recoverable — the record and any recaps are kept, so reach out if
            you need it restored.
          </p>
          {error && (
            <CodeShakeBox trigger={error}>
              <p
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-orange)",
                }}
              >
                {error}
              </p>
            </CodeShakeBox>
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
          <HoldToConfirmButton
            label="Delete gig"
            holdingLabel="Keep holding…"
            busyLabel="Deleting…"
            busy={submitting}
            onConfirm={() => void submit()}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{
              background: "var(--spark-orange)",
              color: "var(--spark-on-accent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
