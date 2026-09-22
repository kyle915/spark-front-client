import { useEffect, useState } from "react";
import SparkOverlay from "@/shared/SparkOverlay";

/**
 * Sales (and ops) ask Ignite to cancel a scheduled demo.
 * Search by store, or paste the REQ number. The email goes to every
 * Ignite user. The request stays on the schedule until ops cancels it.
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

export default function CancelDemoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCode, setSentCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setSelected(null);
    setReason("");
    setBusy(false);
    setError(null);
    setSentCode(null);
  }, [open]);

  useEffect(() => {
    if (!open || selected) return;
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
  }, [open, query, selected]);

  const submit = async () => {
    const why = reason.trim();
    if (why.length < 3) {
      setError("Add a reason so Ignite knows why this demo should be cancelled.");
      return;
    }
    const lookup = query.trim();
    if (!selected && lookup.length < 2) {
      setError("Search for the store, or paste the request number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await postGql<{ cancelDemo: CancelResult }>(CANCEL, {
        input: {
          requestId: selected?.id ?? null,
          lookup: selected ? null : lookup,
          reason: why,
        },
      });
      const result = data.cancelDemo;
      if (!result?.success) {
        setError(result?.message || "Could not send the cancel email.");
        return;
      }
      setSentCode(result.requestCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the cancel email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SparkOverlay open={open} onClose={() => { if (!busy) onClose(); }} size="lg" label="Cancel a demo">
      <p className="spark-overlay-kicker" style={{ color: "var(--spark-lime)" }}>
        Cancel demo
      </p>
      {sentCode ? (
        <>
          <h2 className="spark-overlay-title">Ignite has been emailed.</h2>
          <p className="spark-overlay-copy">
            {sentCode} is in their inbox. They will take the demo off the schedule.
          </p>
          <div className="spark-overlay-actions">
            <button type="button" onClick={onClose} className="spark-overlay-action spark-overlay-action-primary">
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="spark-overlay-title">Which demo?</h2>
          <p className="spark-overlay-copy">
            Search by store, or paste the request number. Ignite gets the reason.
          </p>
          <label className="block mt-4">
            <span className="spark-overlay-kicker" style={{ color: "rgba(255,255,255,0.45)" }}>
              Request
            </span>
            <input
              value={selected ? `${storeOf(selected)} · ${reqCodeOf(selected.id)}` : query}
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
              style={{ color: "rgba(255,255,255,0.55)", background: "transparent", border: "none", padding: 0 }}
            >
              Clear
            </button>
          ) : null}
          {!selected && hits.length > 0 ? (
            <ul className="mt-2" style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}>
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
                    <span className="block text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {reqCodeOf(hit.id)}
                      {hit.date ? ` · ${hit.date.slice(0, 10)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!selected && searching ? (
            <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              Searching…
            </p>
          ) : null}
          <label className="block mt-4">
            <span className="spark-overlay-kicker" style={{ color: "rgba(255,255,255,0.45)" }}>
              Reason
            </span>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              rows={3}
              placeholder="The account cancelled."
              className="w-full text-sm"
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
            >
              {busy ? "Sending…" : "Email Ignite to cancel"}
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
        </>
      )}
    </SparkOverlay>
  );
}
