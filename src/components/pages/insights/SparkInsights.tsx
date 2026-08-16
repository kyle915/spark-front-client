import { lazy, Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import PaceWidget from "@/components/pages/dashboard-event/PaceWidget";
import { DashboardSkeleton } from "@/layout/PageSkeletons";

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

const TYPE_CONFIG: Array<{
  match: RegExp;
  label: string;
  color: string;
}> = [
  { match: /retail/i, label: "Retail samplings", color: "var(--spark-lime)" },
  { match: /on[-\s]?prem|bar|venue/i, label: "On-premise", color: "var(--spark-purple)" },
  { match: /event|activation|festival|pop[-\s]?up/i, label: "Events", color: "var(--spark-sky)" },
];

const classifyType = (name: string | null | undefined): string => {
  if (!name) return "Other";
  for (const t of TYPE_CONFIG) {
    if (t.match.test(name)) return t.label;
  }
  return "Other";
};

const ActivationBreakdown: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const counts = useMemo(() => {
    const buckets: Record<string, number> = {};
    const edges = data?.requests?.edges ?? [];
    for (const e of edges) {
      const n = e?.node;
      if (!n) continue;
      const slug = (n.status?.slug ?? n.status?.name ?? "")
        .toString()
        .toLowerCase();
      const counted =
        slug.includes("done") ||
        slug.includes("complete") ||
        slug.includes("scheduled") ||
        slug.includes("approved");
      if (!counted) continue;
      const label = classifyType(n.requestType?.name);
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return buckets;
  }, [data]);

  const display = TYPE_CONFIG.map((t) => ({
    label: t.label,
    color: t.color,
    value: counts[t.label] ?? 0,
  }));

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5">
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
          CONFIRMED + COMPLETED
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {display.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="spark-dot"
                style={{
                  background: s.color,
                  boxShadow: `0 0 8px ${s.color}`,
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
                color: s.color,
              }}
            >
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

function InsightsInner() {
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");

  const filters: DashboardFilters = useMemo(() => {
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
    return {
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: fmt(start),
      endDate: fmt(today),
    };
  }, [range]);

  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const recent = dashboard.recentEvents ?? [];
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range;

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl">
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
          KPIs, map, and what people are saying. Timeline range lives on
          that card — Program KPIs keep their own year control.
        </p>
      </div>

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
          <TenantKpiCharts tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantKpiComparison tenantId={tenantId} />
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
          <TenantSentimentCard tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantGeoHeatmap tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <TenantBaLeaderboard tenantId={tenantId} />
        </Suspense>
      )}

      {tenantId && (
        <Suspense fallback={null}>
          <MetroBreakdownCard tenantId={tenantId} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <ActivationBreakdown />
      </Suspense>

      <div className="spark-card p-6 lg:p-8">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2
            className="display text-lg lg:text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Timeline
          </h2>
          <div className="flex items-center gap-3">
            <div className="pill-group">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`pill-btn ${r.key === range ? "on" : ""}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
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
        </div>
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          SHOWING {rangeLabel}
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
