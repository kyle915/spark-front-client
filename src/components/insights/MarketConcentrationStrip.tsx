import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { TenantMarketPerformanceQuery } from "@/api/queries/TenantMarketPerformanceQuery";
import type { TenantMarketPerformanceQuery as TenantMarketPerformanceQueryType } from "@api/queries/__generated__/TenantMarketPerformanceQuery.graphql";
import { collapseSamplingKpis } from "@/lib/collapseSamplingKpis";

/**
 * Top markets by approved reach for the Insights page range — exec
 * concentration strip above the full geo map.
 */

const fmt = (n: number) => n.toLocaleString();

const Inner: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  onStateSelect?: (code: string) => void;
}> = ({ tenantId, startDate, endDate, rangeLabel, onStateSelect }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<TenantMarketPerformanceQueryType>(
    TenantMarketPerformanceQuery,
    { tenantId, startDate, endDate, year: null },
    { fetchPolicy: "store-or-network" },
  );

  const ranked = useMemo(() => {
    const rows = (data.tenantMarketPerformance ?? []).map((r) => {
      const tiles = collapseSamplingKpis({
        consumersReached: r.consumersReached,
        samplesDistributed: r.samplesDistributed,
        totalEngagements: r.totalEngagements,
      });
      const reach = tiles[0]?.value ?? 0;
      return {
        state: (r.state ?? "").toUpperCase(),
        reach,
        productsSold: r.productsSold,
        recapCount: r.recapCount,
      };
    });
    const withReach = rows
      .filter((r) => r.state && r.reach > 0)
      .sort((a, b) => b.reach - a.reach);
    const total = withReach.reduce((s, r) => s + r.reach, 0);
    return withReach.slice(0, 5).map((r, i) => ({
      ...r,
      rank: i + 1,
      pct: total > 0 ? Math.round((r.reach / total) * 100) : 0,
      total,
    }));
  }, [data]);

  if (ranked.length === 0) return null;

  return (
    <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            WHERE THE PROGRAM LIVES · {rangeLabel.toUpperCase()}
          </p>
          <h2
            className="display text-lg font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Top markets
          </h2>
        </div>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.12em", color: "var(--spark-text-meta)" }}
        >
          BY APPROVED REACH
        </p>
      </div>

      <div className="space-y-2">
        {ranked.map((r) => (
          <button
            key={r.state}
            type="button"
            onClick={() => {
              onStateSelect?.(r.state);
              navigate(`/requests/list?market=${encodeURIComponent(r.state)}`);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.03)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <span
              className="mono text-[11px] w-6"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {String(r.rank).padStart(2, "0")}
            </span>
            <span className="font-semibold flex-1">{r.state}</span>
            <span
              className="tab-num text-sm font-bold"
              style={{ color: "var(--spark-lime)" }}
            >
              {fmt(r.reach)}
            </span>
            <span
              className="mono text-[10px] w-12 text-right"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {r.pct}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default function MarketConcentrationStrip(props: {
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  onStateSelect?: (code: string) => void;
}) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
