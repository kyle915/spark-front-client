import { useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@/api/relay/environment";
import { RecapPhotoReuseQuery } from "@/api/queries/RecapPhotoReuseQuery";
import type { RecapPhotoReuseQuery as RecapPhotoReuseQueryType } from "@/api/queries/__generated__/RecapPhotoReuseQuery.graphql";

/**
 * Admin review aid: same stored photo hash or path on another recap.
 * The check runs when the reviewer asks, not on page load. It does not
 * approve or reject.
 */

type ReuseStatus = "clear" | "reused";

type ReuseItem = {
  fileId: string;
  fileUrl: string;
  status: string;
  label: string;
};

function statusWord(status: ReuseStatus): string {
  switch (status) {
    case "clear":
      return "Clear";
    case "reused":
      return "Reused";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function asStatus(value: string): ReuseStatus | null {
  if (value === "clear" || value === "reused") return value;
  return null;
}

export function RecapPhotoReusePanel({
  recapId,
  isCustom,
}: {
  recapId: string;
  isCustom: boolean;
}) {
  const [items, setItems] = useState<ReuseItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = () => {
    if (busy) return;
    setBusy(true);
    setError("");
    fetchQuery<RecapPhotoReuseQueryType>(environment, RecapPhotoReuseQuery, {
      recapId,
      isCustom,
    })
      .toPromise()
      .then((data) => {
        setItems(data?.recapPhotoReuse?.items ? [...data.recapPhotoReuse.items] : []);
      })
      .catch(() => {
        setError("Couldn't check photos. Try again.");
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="spark-card p-6" style={{ borderRadius: 18 }}>
      <div className="flex items-center gap-3 flex-wrap">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--recap-heading, #3f5c12)" }}
        >
          Photo reuse
        </p>
        <button
          type="button"
          className="text-[13px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            color: "#1c1917",
            background: "#fff",
            border: "1px solid #e2e4d8",
          }}
          onClick={run}
          disabled={busy}
        >
          {busy ? "Checking…" : "Check photos"}
        </button>
      </div>
      <p className="text-[13px] mt-2" style={{ color: "#5c6154" }}>
        Same stored photo on another recap or date. This does not approve or reject.
      </p>
      {error ? (
        <p className="text-[13px] mt-3" style={{ color: "#9b2c14" }}>
          {error}
        </p>
      ) : null}
      {items && items.length === 0 ? (
        <p className="text-[13px] mt-3" style={{ color: "#5c6154" }}>
          No photos to check.
        </p>
      ) : null}
      {items && items.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => {
            const status = asStatus(item.status);
            const word = status ? statusWord(status) : item.status;
            const reused = status === "reused";
            return (
              <li
                key={item.fileId}
                className="text-[13px] px-2.5 py-1 rounded-full inline-flex"
                style={{
                  color: reused ? "#9b2c14" : "#3f5c12",
                  background: reused ? "rgba(239, 90, 42, 0.10)" : "rgba(63, 92, 18, 0.08)",
                  border: `1px solid ${reused ? "rgba(155, 44, 20, 0.38)" : "rgba(63, 92, 18, 0.28)"}`,
                }}
              >
                {word}
                {item.label ? ` — ${item.label}` : ""}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
