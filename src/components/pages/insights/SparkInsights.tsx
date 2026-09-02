import { lazy, Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import PaceWidget from "@/components/pages/dashboard-event/PaceWidget";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
import BelowFold from "@/components/insights/BelowFold";
import { TenantActivationBreakdownQuery } from "@/api/queries/TenantActivationBreakdownQuery";
import type { TenantActivationBreakdownQuery as TenantActivationBreakdownQueryType } from "@api/queries/__generated__/TenantActivationBreakdownQuery.graphql";

const TenantKpiCharts = lazy(() => import("@/components/ai/TenantKpiCharts"));
const TenantKpiComparison = lazy(
  () => import("@/components/ai/TenantKpiComparison"),
);
const TenantGoalsPanel = lazy(() => import("@/components/ai/TenantGoalsPanel"));
const TenantInsightsPanel = lazy(
  () => import("@/components/ai/TenantInsightsPanel"),
);
const TenantSentimentCard = lazy(
  () => import("@/components/ai/TenantSentimentCard"),
);
const TenantGeoHeatmap = lazy(() => import("@/components/ai/TenantGeoHeatmap"));
const TenantBaLeaderboard = lazy(
  () => import("@/components/ai/TenantBaLeaderboard"),
);
const MetroBreakdownCard = lazy(
  () => import("@/components/pages/dashboard-event/MetroBreakdownCard"),
);

type RangeKey = "7d" | "30d" | "qtd" | "ytd";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "qtd", label: "90d" },
  { key: "ytd", label: "YTD" },
];

const BUCKET_COLORS: Record<string, string> = {
  retail: "var(--spark-lime)",
  onprem: "var(--spark-orange)",
  event: "var(--spark-sky)",
  other: "rgba(255,255,255,0.45)",
};

/** Map page range → comparison period the year/month API can express. */
const comparisonPeriodForRange = (
  range: RangeKey,
): "month" | "quarter" | "year" => {
  switch (range) {
    case "7d":
    case "30d":
      return "month";
    case "qtd":
      return "quarter";
    case "ytd":
      return "year";
    default: {
      const _exhaustive: never = range;
      return _exhaustive;
    }
  }
};

const ActivationBreakdown: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
}> = ({ tenantId, startDate, endDate, rangeLabel }) => {
  const data = useLazyLoadQuery<TenantActivationBreakdownQueryType>(
    TenantActivationBreakdownQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );

  const display = (data.tenantActivationBreakdown?.buckets ?? []).filter(
    (b) => b.key !== "other" || b.count > 0,
  );

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          By activation type
        </h2>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          CONFIRMED + COMPLETED · {rangeLabel.toUpperCase()}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {display.map((s) => {
          const color = BUCKET_COLORS[s.key] ?? BUCKET_COLORS.other;
          return (
            <div key={s.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="spark-dot"
                  style={{
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                />
                <p className="label-mini">{s.label.toUpperCase()}</p>
              </div>
              <p
                className="display tab-num font-bold"
                style={{
                  fontSize: "2.5rem",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  color,
                }}
              >
                {s.count.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function InsightsInner() {
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");

  const { startDate, endDate, filters } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    if (range === "ytd") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else {
      const daysBack = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      start.setDate(today.getDate() - daysBack);
    }
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const startDate = fmt(start);
    const endDate = fmt(today);
    const filters: DashboardFilters = {
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate,
      endDate,
    };
    return { startDate, endDate, filters };
  }, [range]);

  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const recent = dashboard.recentEvents ?? [];
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range;
  const comparisonPeriod = comparisonPeriodForRange(range);
  const kpiYear = new Date().getFullYear();

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            PROGRAM ANALYTICS
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-2 leading-[1.1]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Insights
          </h1>
          <p
            className="mt-3 text-base"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Page range scopes Timeline, Activation, and period comparison.
            Program KPIs stay calendar-year (API is year-based).
          </p>
        </div>
        <div className="pill-group">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`pill-btn ${r.key === range ? "on" : ""}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p
        className="mono text-[10px] -mt-2"
        style={{
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        SHOWING {rangeLabel.toUpperCase()} · {startDate} → {endDate}
      </p>

      <PaceWidget />

      {tenantId && (
        <Suspense
          fallback={
            <div
              className="spark-card p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading program KPIs…
            </div>
          }
        >
          <TenantKpiCharts
            tenantId={tenantId}
            scopeNote={`Calendar ${kpiYear} · not scoped to ${rangeLabel}`}
          />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantKpiComparison
            tenantId={tenantId}
            period={comparisonPeriod}
            scopeNote={`Aligned to ${rangeLabel} (nearest complete period)`}
          />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantGoalsPanel tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantInsightsPanel tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <ActivationBreakdown
            tenantId={tenantId}
            startDate={startDate}
            endDate={endDate}
            rangeLabel={rangeLabel}
          />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantSentimentCard tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <BelowFold
          fallback={
            <div
              className="spark-card p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Map & leaderboard load as you scroll…
            </div>
          }
        >
          <div className="space-y-6 lg:space-y-8">
            <Suspense fallback={null}>
              <TenantGeoHeatmap tenantId={tenantId} />
            </Suspense>
            <Suspense fallback={null}>
              <TenantBaLeaderboard tenantId={tenantId} />
            </Suspense>
            <Suspense fallback={null}>
              <MetroBreakdownCard tenantId={tenantId} />
            </Suspense>
          </div>
        </BelowFold>
      )}

      <div className="spark-card p-6 lg:p-8">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2
            className="display text-lg lg:text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Timeline
          </h2>
          <button
            type="button"
            onClick={() => navigate("/requests/list")}
            className="mono text-[10px] transition"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            ALL EVENTS →
          </button>
        </div>
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          SHOWING {rangeLabel.toUpperCase()}
        </p>

        {recent.length === 0 ? (
          <p
            className="text-sm py-10 text-center"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No data yet. New events show up here as they&apos;re scheduled.
          </p>
        ) : (
          <div>
            {recent.slice(0, 10).map((e, i) => {
              const dateStr = e.date ?? "";
              const isToday =
                dateStr &&
                new Date(dateStr).toDateString() === new Date().toDateString();
              const isPast = dateStr && new Date(dateStr) < new Date();
              const dot = isToday
                ? "var(--spark-lime)"
                : isPast
                  ? "rgba(255,255,255,0.3)"
                  : "var(--spark-sky)";
              return (
                <div
                  key={i}
                  onClick={() =>
                    isPast
                      ? navigate("/recaps/list")
                      : navigate("/requests/list")
                  }
                  className="flex items-center gap-4 py-3 cursor-pointer"
                  style={{
                    borderBottom:
                      i < Math.min(recent.length, 10) - 1
                        ? "1px solid var(--spark-border)"
                        : "none",
                    opacity: isPast ? 0.72 : 1,
                  }}
                >
                  <span
                    className="spark-dot shrink-0"
                    style={{
                      background: dot,
                      boxShadow: `0 0 8px ${dot}`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {e.name ?? "Untitled"}
                    </p>
                    <p
                      className="mono text-[10px] mt-0.5 truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                        textTransform: "uppercase",
                      }}
                    >
                      {e.location ?? ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-sm"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      {dateStr || "—"}
                    </p>
                    <p
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: isToday
                          ? "var(--spark-lime)"
                          : isPast
                            ? "rgba(255,255,255,0.45)"
                            : "var(--spark-sky)",
                      }}
                    >
                      {isToday
                        ? "TODAY"
                        : isPast
                          ? (e.status ?? "DONE").toUpperCase()
                          : (e.status ?? "SCHEDULED").toUpperCase()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SparkInsights() {
  return (
    <Layout>
      <Suspense fallback={<DashboardSkeleton />}>
        <InsightsInner />
      </Suspense>
    </Layout>
  );
}
