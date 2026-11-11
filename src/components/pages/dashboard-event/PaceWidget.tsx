import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { ExecutiveSummaryQuery } from "@/api/queries/ExecutiveSummaryQuery";
import type { ExecutiveSummaryQuery as ExecutiveSummaryQueryType } from "@api/queries/__generated__/ExecutiveSummaryQuery.graphql";

/**
 * Dashboard "Pace" widget — same numbers the weekly Monday exec
 * summary email surfaces, rendered live so kyle can mid-week check
 * "how are we doing vs last week" without waiting for the email.
 *
 * Headlines: recaps filed · consumers reached · samples out.
 * Each has a delta chip ("↑ 12% vs prior week") when comparison
 * data is available.
 *
 * Tap-through goes to /reports — the deeper view for the same data.
 */

const Inner: React.FC<{ tenantId: string | null }> = ({ tenantId }) => {
  const navigate = useNavigate();

  const data = useLazyLoadQuery<ExecutiveSummaryQueryType>(
    ExecutiveSummaryQuery,
    { tenantId: tenantId ?? null, windowDays: 7 },
    { fetchPolicy: "store-or-network" },
  );

  const summary = data?.executiveSummary;
  if (!summary) {
    // Tenant scope absent — happens before TenantGuard resolves on
    // first paint, or in client-only views where no tenant is in
    // scope. Hide rather than show an awkward "no data" tile.
    return null;
  }

  // Don't render the tile during a tenant's first week with zero
  // recaps — the headlines would all be 0 and the chips empty.
  // Empty-week is a valid signal once data exists; first-week-empty
  // is just noise on the dashboard.
  if (
    summary.recapCount === 0 &&
    summary.consumerReach === 0 &&
    summary.samplesDistributed === 0
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => navigate("/reports")}
      className="spark-card hov text-left w-full p-4 lg:p-5"
      style={{ borderRadius: 18 }}
      title="Tap to open Reports"
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta)",
          }}
        >
          PACE · LAST 7 DAYS
        </p>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "var(--spark-text-meta)",
          }}
          title={summary.periodLabel}
        >
          {summary.periodLabel}
        </p>
      </div>

      <div className={`grid gap-3 ${summary.consumerReach === summary.samplesDistributed ? "grid-cols-2" : "grid-cols-3"}`}>
        <StatTile
          label="Recaps"
          value={summary.recapCount}
          chip={summary.recapCountDeltaChip}
        />
        <StatTile
          label="Consumers sampled"
          value={summary.consumerReach || summary.samplesDistributed}
          chip={summary.consumerReachDeltaChip}
          highlight
        />
        {summary.consumerReach !== summary.samplesDistributed && (
          <StatTile
            label="Samples Out"
            value={summary.samplesDistributed}
          />
        )}
      </div>

      {(summary.topStores.length > 0 || summary.topBas.length > 0) && (
        <div
          className="mt-4 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          {summary.topStores.length > 0 && (
            <RankedList
              title="TOP STORES"
              rows={summary.topStores.map((r) => ({
                label: r.label,
                value: r.primaryMetric,
                hint: r.secondaryMetric ?? null,
              }))}
              unit="consumers"
            />
          )}
          {summary.topBas.length > 0 && (
            <RankedList
              title="TOP BAS"
              rows={summary.topBas.map((r) => ({
                label: r.label,
                value: r.primaryMetric,
                hint: null,
              }))}
              unit="recaps"
            />
          )}
        </div>
      )}
    </button>
  );
};

const StatTile: React.FC<{
  label: string;
  value: number;
  chip?: string | null;
  highlight?: boolean;
}> = ({ label, value, chip, highlight }) => (
  <div
    className="rounded-xl p-3"
    style={{
      background: highlight
        ? "rgba(var(--spark-accent-rgb),0.08)"
        : "rgba(var(--spark-ink-rgb),0.03)",
      border: `1px solid ${highlight ? "rgba(var(--spark-accent-rgb),0.30)" : "var(--spark-border)"}`,
    }}
  >
    <p
      className="mono text-[9px]"
      style={{
        letterSpacing: "0.14em",
        color: "var(--spark-text-meta)",
      }}
    >
      {label.toUpperCase()}
    </p>
    <p
      className="tab-num font-bold mt-1"
      style={{
        fontSize: 22,
        color: highlight ? "var(--spark-lime)" : "var(--spark-text)",
      }}
    >
      {value.toLocaleString()}
    </p>
    {chip && (
      <p
        className="text-[10px] mt-0.5 truncate"
        style={{ color: "var(--spark-text-meta)" }}
        title={chip}
      >
        {chip}
      </p>
    )}
  </div>
);

const RankedList: React.FC<{
  title: string;
  rows: { label: string; value: number; hint: string | null }[];
  unit: string;
}> = ({ title, rows, unit }) => (
  <div>
    <p
      className="mono text-[9px] mb-1.5"
      style={{
        letterSpacing: "0.18em",
        color: "var(--spark-text-meta)",
      }}
    >
      {title}
    </p>
    <div className="space-y-1">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-2"
        >
          <p
            className="text-xs truncate"
            style={{ color: "var(--spark-text)" }}
            title={r.hint ? `${r.label} · ${r.hint}` : r.label}
          >
            {r.label}
          </p>
          <p
            className="mono text-[10px] shrink-0"
            style={{
              letterSpacing: "0.12em",
              color: "var(--spark-text-secondary)",
            }}
          >
            {r.value.toLocaleString()} {unit}
          </p>
        </div>
      ))}
    </div>
  </div>
);

export default function PaceWidget() {
  const { tenantId } = useAuthStore();
  return (
    <Suspense fallback={null}>
      <Inner tenantId={tenantId ?? null} />
    </Suspense>
  );
}
