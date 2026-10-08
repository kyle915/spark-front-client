import { useEffect, useState } from "react";
import { Link } from "react-router";
import SparkSheet from "@/shared/SparkSheet";
import { fetchPlanResults, type PlanResults } from "./planResultsApi";
import {
  fmtMetricValue,
  pctOfPlan,
  recapStatusLabel,
} from "./planResultsFormat";

function statusChip(status: PlanResults["recaps"][number]["status"]): string {
  if (status === "approved") return "chip chip-lime";
  if (status === "needs_review") return "chip chip-orange";
  return "chip";
}

/** Planned vs Actual for one plan, summed from its approved recaps. */
export default function PlanResultsSheet({
  planId,
  planName,
  open,
  onOpenChange,
  isClient,
}: {
  planId: string;
  planName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isClient: boolean;
}) {
  const [results, setResults] = useState<PlanResults | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError("");
    setResults(null);
    fetchPlanResults(planId)
      .then((data) => {
        if (alive) setResults(data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load results.");
      });
    return () => {
      alive = false;
    };
  }, [open, planId]);

  const rows = results?.rows ?? [];
  // The server already hides unapproved recaps from client logins; the
  // admin "Client view" toggle needs the same cut here.
  const recaps = (results?.recaps ?? []).filter(
    (recap) => !isClient || recap.status === "approved",
  );
  const pending = isClient ? 0 : (results?.pending ?? 0);

  return (
    <SparkSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="PLAN · RESULTS"
      title={planName}
    >
      <div className="max-w-3xl mx-auto px-5 py-4 space-y-5">
        {error ? (
          <p className="text-sm" style={{ color: "var(--spark-orange)" }}>
            {error}
          </p>
        ) : null}
        {!results && !error ? <p className="spark-support">Loading results…</p> : null}
        {results ? (
          <p className="text-sm opacity-70">
            {results.counted} approved recap{results.counted === 1 ? "" : "s"} counted
            {pending
              ? ` · ${pending} in review, not in totals yet`
              : ""}
          </p>
        ) : null}

        {results && rows.length === 0 ? (
          <p className="spark-support">
            {isClient
              ? "Results show here once Ignite approves the recaps from this plan."
              : "No recap metrics on this plan yet. Open a recap and use Push to plan."}
          </p>
        ) : null}

        {rows.length ? (
          <section
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            <div
              className="grid grid-cols-[1fr_80px_90px] gap-2 px-3 py-2 text-[11px] uppercase tracking-wider opacity-55"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <span>Metric</span>
              <span className="text-right">Planned</span>
              <span className="text-right">Actual</span>
            </div>
            {rows.map((row) => {
              const pct = pctOfPlan(row.planned, row.actual);
              return (
                <div
                  key={row.key}
                  className="px-3 py-2.5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="grid grid-cols-[1fr_80px_90px] gap-2 items-baseline">
                    <span className="text-sm">{row.label}</span>
                    <span className="text-right tabular-nums text-sm opacity-70">
                      {fmtMetricValue(row.planned, row.unit)}
                    </span>
                    <span
                      className="text-right tabular-nums text-sm font-semibold"
                      style={{ color: row.actual != null ? "var(--spark-lime)" : undefined }}
                    >
                      {row.actual != null
                        ? fmtMetricValue(row.actual, row.unit)
                        : row.text || "—"}
                    </span>
                  </div>
                  {pct != null ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1 flex-1 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: pct >= 100 ? "var(--spark-lime)" : "var(--spark-orange)",
                          }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums opacity-60">
                        {pct}% of plan
                      </span>
                    </div>
                  ) : null}
                  {row.parts.length ? (
                    <p className="mt-1 text-[11px] opacity-55">
                      {row.parts.map((p) => `${p.label} × ${p.value}`).join(" · ")}
                    </p>
                  ) : null}
                  {row.note ? (
                    <p className="mt-0.5 text-[11px] opacity-45">{row.note}</p>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        {recaps.length ? (
          <section className="space-y-2">
            <p className="label-mini">Recaps on this plan</p>
            {recaps.map((recap) => (
              <div
                key={recap.uuid}
                className="rounded-xl p-3 flex flex-wrap items-start justify-between gap-3"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{recap.name}</p>
                  <p className="text-xs opacity-60">
                    {[recap.date, recap.baName].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={statusChip(recap.status)}>
                      {recapStatusLabel(recap.status)}
                    </span>
                    {recap.auto && !isClient ? (
                      <span className="chip">Auto-attached</span>
                    ) : null}
                  </div>
                  {recap.metrics.length ? (
                    <p className="mt-1.5 text-[11px] opacity-55">
                      {recap.metrics.map((m) => `${m.label}: ${m.text}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Link
                  to={recap.href}
                  className="spark-btn-ghost !px-3 !py-1.5 text-xs shrink-0"
                >
                  Open recap
                </Link>
              </div>
            ))}
          </section>
        ) : null}

        <p className="text-[11px] opacity-45 pb-2">
          Actuals add up approved recaps only, using the metrics ops picked for
          each one. Consumers sampled, people engaged, samples handed out, emails
          and cases are separate counts.
        </p>
      </div>
    </SparkSheet>
  );
}
