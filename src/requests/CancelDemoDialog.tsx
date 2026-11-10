import { useEffect, useState } from "react";
import SparkOverlay from "@/shared/SparkOverlay";
import { useAlertStore } from "@/store/alertStore";

/**
 * Cancel a scheduled event / request with comments.
 * Immediately cancels the event/request and emails both Ignite and the
 * client/brand with the cancellation comments.
 * Can be opened pre-bound to a specific `requestId` (from Event or Request
 * detail pages) or in search mode (from Master Tracker).
 */

type Hit = {
  id: string;
  name: string | null;
  date: string | null;
  retailerName: string | null;
};

type CancelResult = {
  success: boolean;
  message: string;
  requestCode: string | null;
};

const SEARCH = `
  query CancelDemoSearch($filters: RequestFiltersInput, $first: Int) {
    requests(filters: $filters, first: $first) {
      edges {
        node {
          id
          name
          date
          retailer { name }
        }
      }
    }
  }
`;

const CANCEL = `
  mutation CancelDemo($input: CancelDemoInput!) {
    cancelDemo(input: $input) {
      success
      message
      requestCode
    }
  }
`;

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
    throw new Error(json.errors[0]?.message || "Request failed");
  }
  return json.data as T;
}

function reqCodeOf(id: string): string {
  return `REQ-${id.slice(-4).toUpperCase()}`;
}

function storeOf(hit: Hit): string {
  return (hit.retailerName || hit.name || "Request").trim();
}

export type CancelDemoDialogProps = {
  open: boolean;
  onClose: () => void;
  requestId?: string | null;
  storeName?: string | null;
  dateLabel?: string | null;
  brandName?: string | null;
  onSent?: (requestCode: string | null) => void;
};

export default function CancelDemoDialog({
  open,
  onClose,
  requestId,
  storeName,
  dateLabel,
  brandName,
  onSent,
}: CancelDemoDialogProps) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setSelected(null);
    setReason("");
    setBusy(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || selected || requestId) return;
    const text = query.trim();
    if (text.length < 2 || text.toUpperCase().startsWith("REQ-")) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      postGql<{
        requests: {
          edges: Array<{
            node: {
              id: string;
              name: string | null;
              date: string | null;
              retailer: { name: string | null } | null;
            };
          }>;
        };
      }>(SEARCH, { filters: { name: text }, first: 8 })
        .then((data) => {
          if (cancelled) return;
          setHits(
            (data.requests?.edges ?? []).map((edge) => ({
              id: edge.node.id,
              name: edge.node.name,
              date: edge.node.date,
              retailerName: edge.node.retailer?.name ?? null,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, selected, requestId]);

  const submit = async () => {
    const why = reason.trim();
    if (why.length < 3) {
      setError("Add a cancellation reason or comment.");
      return;
    }
    const targetRequestId = requestId || selected?.id || null;
    const lookup = query.trim();
    if (!targetRequestId && lookup.length < 2) {
      setError("Search for the store, or paste the request number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await postGql<{ cancelDemo: CancelResult }>(CANCEL, {
        input: {
          requestId: targetRequestId,
          lookup: targetRequestId ? null : lookup,
          reason: why,
        },
      });
      const result = data.cancelDemo;
      if (!result?.success) {
        setError(result?.message || "Could not cancel the event.");
        return;
      }
      showAlert("Event cancelled — confirmation email sent.", "success");
      onSent?.(result.requestCode ?? null);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel the event.",
      );
    } finally {
      setBusy(false);
    }
  };

  const contextSummary = [brandName, storeName, dateLabel]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <SparkOverlay
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      size="lg"
      label="Cancel event"
    >
      <p
        className="spark-overlay-kicker"
        style={{ color: "var(--spark-orange)" }}
      >
        Cancel event
      </p>
      <h2 className="spark-overlay-title">Cancel event</h2>
      <p className="spark-overlay-copy">
        {requestId
          ? contextSummary ||
            "This immediately cancels the event and emails a confirmation with your comments."
          : "Search by store, or paste the request number. This immediately cancels the event and emails a confirmation with your comments."}
      </p>
      {!requestId && (
        <>
          <label className="block mt-4">
            <span
              className="spark-overlay-kicker"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Request
            </span>
            <input
              value={
                selected
                  ? `${storeOf(selected)} · ${reqCodeOf(selected.id)}`
                  : query
              }
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
                setError(null);
              }}
              placeholder="Store name, or REQ-…"
              className="spark-filter-search w-full"
              autoFocus
            />
          </label>
          {selected ? (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
              className="mt-2 text-xs"
              style={{
                color: "var(--spark-text-meta)",
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              Clear
            </button>
          ) : null}
          {!selected && hits.length > 0 ? (
            <ul
              className="mt-2"
              style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}
            >
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(hit);
                      setHits([]);
                      setError(null);
                    }}
                    className="w-full text-left"
                    style={{
                      background: "transparent",
                      border: "none",
                      borderTop: "1px solid var(--spark-border)",
                      color: "var(--spark-text)",
                      padding: "0.55rem 0",
                    }}
                  >
                    <span className="block text-sm">{storeOf(hit)}</span>
                    <span
                      className="block text-xs"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {reqCodeOf(hit.id)}
                      {hit.date ? ` · ${hit.date.slice(0, 10)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!selected && searching ? (
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Searching…
            </p>
          ) : null}
        </>
      )}
      <label className="block mt-4">
        <span
          className="spark-overlay-kicker"
          style={{ color: "var(--spark-text-meta)" }}
        >
          Cancellation reason / comments (sent in confirmation email)
        </span>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          rows={3}
          placeholder="e.g., Store manager asked to reschedule for next week."
          autoFocus={Boolean(requestId)}
          className="w-full text-sm mt-1.5"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
            borderRadius: 12,
            padding: "0.6rem 0.75rem",
            resize: "vertical",
          }}
        />
      </label>
      {error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--spark-orange)" }}>
          {error}
        </p>
      ) : null}
      <div className="spark-overlay-actions">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="spark-overlay-action spark-overlay-action-primary"
          style={{
            background: "var(--spark-orange)",
            borderColor: "var(--spark-orange)",
            color: "#0a0d09",
          }}
        >
          {busy ? "Cancelling…" : "Cancel event"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="spark-overlay-action spark-overlay-action-cancel"
        >
          Close
        </button>
      </div>
    </SparkOverlay>
  );
}
