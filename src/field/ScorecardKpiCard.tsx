export type ScorecardKpi = {
  key: string;
  label: string;
  detail: string;
  target: number;
  planned: number | null;
  logged: number | null;
  unit: string;
  note?: string | null;
};

function fmtNum(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function unitFor(value: number, unit: string): string {
  return value === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

function pctOf(logged: number | null, target: number): number {
  if (logged == null || target <= 0) return 0;
  return Math.round((logged / target) * 100);
}

/**
 * One scorecard bucket. Leads with the actual result (manual log, else
 * approved recaps on the plan) against the monthly target; the plan's
 * forecast is secondary and "not forecast" when no plan in scope gave one.
 */
export default function ScorecardKpiCard({
  kpi,
  loading = false,
  showTarget = true,
  className = "spark-card p-4",
}: {
  kpi: ScorecardKpi;
  loading?: boolean;
  showTarget?: boolean;
  className?: string;
}) {
  const pct = pctOf(kpi.logged, kpi.target);
  const hasActual = kpi.logged != null;
  return (
    <article className={className}>
      <p className="label-mini mb-2">{kpi.label}</p>
      <p className="tab-num text-2xl lg:text-3xl font-bold leading-none">
        <span
          style={{
            color: hasActual
              ? "var(--spark-lime, #f2f3ee)"
              : "rgba(255,255,255,0.35)",
          }}
        >
          {loading ? "…" : fmtNum(kpi.logged)}
        </span>
        {showTarget ? (
          <span className="text-sm font-normal opacity-60 text-white">
            {" "}
            / {kpi.target.toLocaleString()}
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-xs opacity-75">
        Actual {unitFor(kpi.logged ?? 0, kpi.unit)}
        {hasActual ? "" : " · nothing reported yet"}
      </p>
      <p className="mt-1 text-xs opacity-55">
        Planned{" "}
        {kpi.planned == null
          ? "· not forecast on these plans"
          : `${kpi.planned.toLocaleString()} ${unitFor(kpi.planned, kpi.unit)}`}
      </p>
      {showTarget ? (
        <div className="mt-3" aria-hidden>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.min(100, pct)}%`,
                background: "var(--spark-lime, #f2f3ee)",
                minWidth: hasActual && (kpi.logged ?? 0) > 0 ? 4 : 0,
              }}
            />
          </div>
          <p
            className="mt-1.5 mono text-[9px]"
            style={{ letterSpacing: "0.12em", color: "var(--spark-text-meta)" }}
          >
            ACTUAL {pct}% OF TARGET
          </p>
        </div>
      ) : null}
      {kpi.note ? (
        <p
          className="mt-2 text-[11px] leading-snug"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {kpi.note}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-snug opacity-60">{kpi.detail}</p>
    </article>
  );
}
