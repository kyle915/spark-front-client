import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  fetchPlanRecapSuggestions,
  pushRecapToPlan,
  type PlanRecapSuggestion,
} from "./planResultsApi";
import { recapStatusLabel } from "./planResultsFormat";

/** Admin-only: attach a filed recap to this plan from the plan side. */
export default function AttachRecapsToPlan({
  planId,
  refreshKey,
  onAttached,
}: {
  planId: string;
  refreshKey: number;
  onAttached: () => void;
}) {
  const [rows, setRows] = useState<PlanRecapSuggestion[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setRows(null);
    fetchPlanRecapSuggestions(planId)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((err) => {
        if (alive) {
          setRows([]);
          setError(err instanceof Error ? err.message : "Could not load recaps.");
        }
      });
    return () => {
      alive = false;
    };
  }, [planId, refreshKey]);

  const attach = async (row: PlanRecapSuggestion) => {
    const metricKeys = row.metrics.filter((m) => m.defaultOn).map((m) => m.key);
    setBusyId(row.recapId);
    setError("");
    setMessage("");
    try {
      const res = await pushRecapToPlan({
        recapId: row.recapId,
        kind: row.kind,
        planId,
        metricKeys,
        confirmMove: Boolean(row.currentPlanName),
      });
      setMessage(res.message);
      onAttached();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach that recap.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="space-y-2">
      <p className="label-mini">Attach a recap to this plan</p>
      <p className="text-[11px] opacity-55">
        Recaps filed on this plan's event, or the same tactic within a week.
        Attaching uses the tactic's default metrics — open the recap and use
        Push to plan to change them. Sends no email.
      </p>
      {message ? <p className="text-xs" style={{ color: "var(--spark-lime)" }}>{message}</p> : null}
      {error ? <p className="text-xs" style={{ color: "var(--spark-orange)" }}>{error}</p> : null}
      {rows === null ? <p className="spark-support">Looking for recaps…</p> : null}
      {rows && rows.length === 0 ? (
        <p className="spark-support">No other recaps near this plan.</p>
      ) : null}
      {(rows ?? []).map((row) => {
        const counted = row.metrics.filter((m) => m.defaultOn);
        return (
          <div
            key={`${row.kind}-${row.recapId}`}
            className="rounded-xl p-3 flex flex-wrap items-start justify-between gap-3"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{row.name}</p>
              <p className="text-xs opacity-60">
                {[row.date, row.baName, recapStatusLabel(row.status)].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-[11px] opacity-55">{row.reasons.join(" · ")}</p>
              {counted.length ? (
                <p className="mt-1 text-[11px] opacity-55">
                  {counted.map((m) => `${m.label}: ${m.text}`).join(" · ")}
                </p>
              ) : null}
              {row.currentPlanName ? (
                <p className="mt-1 text-[11px]" style={{ color: "var(--spark-orange)" }}>
                  Counts toward “{row.currentPlanName}” now
                </p>
              ) : null}
            </div>
            <div className="flex gap-2 shrink-0">
              <Link to={row.href} className="spark-btn-ghost !px-3 !py-1.5 text-xs">
                Open
              </Link>
              <button
                type="button"
                className="spark-btn-primary !px-3 !py-1.5 text-xs"
                disabled={Boolean(busyId) || counted.length === 0}
                onClick={() => void attach(row)}
              >
                {busyId === row.recapId
                  ? "Attaching…"
                  : row.currentPlanName
                    ? "Move here"
                    : "Attach"}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
