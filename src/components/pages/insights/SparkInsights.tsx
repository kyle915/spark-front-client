import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { fetchQuery } from "relay-runtime";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Navigate, useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { EventDashboardTimelineQuery } from "@/api/queries/EventDashboardTimelineQuery";
import type { EventDashboardTimelineQuery as EventDashboardTimelineQueryType } from "@api/queries/__generated__/EventDashboardTimelineQuery.graphql";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import BelowFold from "@/components/insights/BelowFold";
import PaceToGoalHero from "@/components/insights/PaceToGoalHero";
import ExecutiveInsightsStrip, {
  buildProgramPulseCopy,
  buildProgramPulseOneLiner,
} from "@/components/insights/ExecutiveInsightsStrip";
import MarketConcentrationStrip from "@/components/insights/MarketConcentrationStrip";
import AskAiButton from "@/components/ai/AskAiButton";
import { TenantActivationBreakdownQuery } from "@/api/queries/TenantActivationBreakdownQuery";
import type { TenantActivationBreakdownQuery as TenantActivationBreakdownQueryType } from "@api/queries/__generated__/TenantActivationBreakdownQuery.graphql";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import type { TenantConversionKpisQuery as TenantConversionKpisQueryType } from "@api/queries/__generated__/TenantConversionKpisQuery.graphql";
import { TenantSkuPulseQuery } from "@/api/queries/TenantSkuPulseQuery";
import type { TenantSkuPulseQuery as TenantSkuPulseQueryType } from "@api/queries/__generated__/TenantSkuPulseQuery.graphql";
import { ExecutiveSummaryQuery } from "@/api/queries/ExecutiveSummaryQuery";
import type { ExecutiveSummaryQuery as ExecutiveSummaryQueryType } from "@api/queries/__generated__/ExecutiveSummaryQuery.graphql";
import { TenantGoalsQuery } from "@/api/queries/TenantGoalsQuery";
import type { TenantGoalsQuery as TenantGoalsQueryType } from "@api/queries/__generated__/TenantGoalsQuery.graphql";
import environment from "@/api/relay/environment";

const TenantKpiCharts = lazy(() => import("@/components/ai/TenantKpiCharts"));
const TenantKpiComparison = lazy(
  () => import("@/components/ai/TenantKpiComparison"),
);
const TenantInsightsPanel = lazy(
  () => import("@/components/ai/TenantInsightsPanel"),
);
const TenantSentimentCard = lazy(
  () => import("@/components/ai/TenantSentimentCard"),
);
const TenantGeoHeatmap = lazy(() => import("@/components/ai/TenantGeoHeatmap"));
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

async function buildInsightsSummaryCopy(opts: {
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
}): Promise<string> {
  const { tenantId, startDate, endDate, rangeLabel } = opts;
  const [pace, goals, conv, mix, sku] = await Promise.all([
    fetchQuery<ExecutiveSummaryQueryType>(
      environment,
      ExecutiveSummaryQuery,
      { tenantId, windowDays: 7 },
      { fetchPolicy: "store-or-network" },
    ).toPromise(),
    fetchQuery<TenantGoalsQueryType>(
      environment,
      TenantGoalsQuery,
      { tenantId, year: null },
      { fetchPolicy: "store-or-network" },
    ).toPromise(),
    fetchQuery<TenantConversionKpisQueryType>(
      environment,
      TenantConversionKpisQuery,
      { tenantId, startDate, endDate },
      { fetchPolicy: "store-or-network" },
    ).toPromise(),
    fetchQuery<TenantActivationBreakdownQueryType>(
      environment,
      TenantActivationBreakdownQuery,
      { tenantId, startDate, endDate },
      { fetchPolicy: "store-or-network" },
    ).toPromise(),
    fetchQuery<TenantSkuPulseQueryType>(
      environment,
      TenantSkuPulseQuery,
      { tenantId, startDate, endDate },
      { fetchPolicy: "store-or-network" },
    ).toPromise(),
  ]);

  const summary = pace?.executiveSummary;
  const goalItems = goals?.tenantGoals?.items ?? [];
  const lines: string[] = [
    `*Insights summary — ${rangeLabel.toUpperCase()} (${startDate} → ${endDate})*`,
    "",
  ];

  const sold = conv?.tenantConversionKpis?.sold ?? 0;
  const sampled = conv?.tenantConversionKpis?.engagements ?? 0;
  const convPct =
    conv?.tenantConversionKpis?.pct != null && sold > 0 && sampled > 0
      ? conv.tenantConversionKpis.pct
      : null;
  const mixBuckets = (["retail", "onprem", "event"] as const).map((key) => {
    const row = (mix?.tenantActivationBreakdown?.buckets ?? []).find(
      (b) => b.key === key,
    );
    const label =
      key === "retail"
        ? "Retail demos"
        : key === "onprem"
          ? "On-prem samplings"
          : "Events";
    return { key, label, count: row?.count ?? 0 };
  });
  const topSkus = (sku?.tenantSkuPulse?.items ?? []).map((i) => ({
    product: i.product,
    samples: i.samples,
  }));
  const oneLiner = buildProgramPulseOneLiner({
    rangeLabel,
    convPct,
    sold,
    sampled,
    mix: mixBuckets,
    topSkus,
    totalSamples: sku?.tenantSkuPulse?.totalSamples ?? 0,
  });
  lines.push(
    buildProgramPulseCopy({
      rangeLabel,
      startDate,
      endDate,
      convPct,
      sold,
      sampled,
      mix: mixBuckets,
      topSkus,
      totalSamples: sku?.tenantSkuPulse?.totalSamples ?? 0,
      oneLiner,
    }),
    "",
  );

  if (summary) {
    lines.push(
      `*Last 7 days* (${summary.periodLabel})`,
      `• Recaps: ${summary.recapCount}${summary.recapCountDeltaChip ? ` · ${summary.recapCountDeltaChip}` : ""}`,
      `• Consumers: ${(summary.consumerReach || summary.samplesDistributed).toLocaleString()}${summary.consumerReachDeltaChip ? ` · ${summary.consumerReachDeltaChip}` : ""}`,
      "",
    );
  }

  const withTargets = goalItems.filter((i) => i.target > 0);
  if (withTargets.length > 0) {
    lines.push(`*Pace to goal · ${goals?.tenantGoals?.year ?? ""}*`);
    for (const item of withTargets) {
      lines.push(
        `• ${item.label}: ${item.current.toLocaleString()} / ${item.target.toLocaleString()} (${Math.round(item.pacePct)}%)`,
      );
    }
    lines.push("");
  }

  lines.push("Open Dashboard or /reports for the full view.");
  return lines.join("\n");
}

/** Heavy eventDashboard fetch isolated so above-fold KPIs paint first. */
function InsightsTimeline({
  tenantId,
  filters,
  rangeLabel,
  selectedState,
  onClearState,
}: {
  tenantId: string;
  filters: DashboardFilters;
  rangeLabel: string;
  selectedState: string | null;
  onClearState: () => void;
}) {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<EventDashboardTimelineQueryType>(
    EventDashboardTimelineQuery,
    {
      filters: {
        tenantId,
        ...(filters ?? {}),
        sections: ["recentEvents"],
      },
    },
    { fetchPolicy: "store-or-network" },
  );
  const recent = data.eventDashboard?.recentEvents ?? [];

  const timelineRows = useMemo(() => {
    if (!selectedState) return recent;
    const needle = selectedState.toUpperCase();
    return recent.filter((e) =>
      (e.location ?? "").toUpperCase().includes(needle),
    );
  }, [recent, selectedState]);

  return (
    <div className="spark-card p-6 lg:p-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Timeline
          {selectedState ? ` · ${selectedState}` : ""}
        </h2>
        <div className="flex items-center gap-3">
          {selectedState && (
            <button
              type="button"
              onClick={onClearState}
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-orange)",
              }}
            >
              CLEAR STATE
            </button>
          )}
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
      </div>
      <p
        className="mono text-[10px] mb-4"
        style={{
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        SHOWING {rangeLabel.toUpperCase()}
        {selectedState ? ` · ${selectedState}` : ""}
      </p>

      {timelineRows.length === 0 ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {selectedState
            ? `No timeline rows for ${selectedState} in this range.`
            : "No data yet. New events show up here as they're scheduled."}
        </p>
      ) : (
        <div>
          {timelineRows.slice(0, 10).map((e, i) => {
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
                    i < Math.min(timelineRows.length, 10) - 1
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
  );
}

/** Program analytics body — embedded on Dashboard (admin + client). */
export function InsightsBody({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [range, setRange] = useState<RangeKey>("30d");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#performance") return;
    const t = window.setTimeout(() => {
      document.getElementById("performance")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

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

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range;
  const comparisonPeriod = comparisonPeriodForRange(range);
  const kpiYear = new Date().getFullYear();

  const onCopySummary = async () => {
    if (!tenantId || copying) return;
    setCopying(true);
    try {
      const text = await buildInsightsSummaryCopy({
        tenantId,
        startDate,
        endDate,
        rangeLabel,
      });
      await navigator.clipboard.writeText(text);
      showAlert("Insights summary copied.", "success");
    } catch (err) {
      showAlert(
        `Couldn't copy: ${(err as Error).message || "clipboard blocked"}`,
        "error",
      );
    } finally {
      setCopying(false);
    }
  };

  const rangeControls = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="pill-group">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              setRange(r.key);
              setSelectedState(null);
            }}
            className={`pill-btn ${r.key === range ? "on" : ""}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <AskAiButton tenantId={tenantId} />
      <button
        type="button"
        onClick={onCopySummary}
        disabled={!tenantId || copying}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "transparent",
          color: "var(--spark-text)",
          border: "1px solid var(--spark-border)",
          opacity: !tenantId || copying ? 0.5 : 1,
        }}
        title="Copy a Slack-friendly summary for this range"
      >
        {copying ? "Copying…" : "Copy summary"}
      </button>
      <button
        type="button"
        onClick={() => navigate("/reports")}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "rgba(197,245,70,0.12)",
          color: "var(--spark-lime)",
          border: "1px solid rgba(197,245,70,0.35)",
        }}
      >
        Open reports
      </button>
    </div>
  );

  return (
    <div
      id="performance"
      className={
        embedded
          ? "space-y-6 lg:space-y-8"
          : "space-y-6 lg:space-y-8 max-w-7xl"
      }
    >
      {embedded ? (
        <div className="flex items-end justify-between flex-wrap gap-4 pt-2">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              PROGRAM PERFORMANCE
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Range scopes Timeline, Activation, and geo. Program KPIs stay
              calendar-year.
            </p>
          </div>
          {rangeControls}
        </div>
      ) : (
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
              Dashboard
            </h1>
            <p
              className="mt-3 text-base"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Page range scopes Timeline, Activation, and geo. Program KPIs
              stay calendar-year.
            </p>
          </div>
          {rangeControls}
        </div>
      )}

      <p
        className="mono text-[10px] -mt-2"
        style={{
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        SHOWING {rangeLabel.toUpperCase()} · {startDate} → {endDate}
        {selectedState ? ` · STATE ${selectedState}` : ""}
      </p>

      {tenantId && <PaceToGoalHero tenantId={tenantId} />}

      {tenantId && (
        <ExecutiveInsightsStrip
          tenantId={tenantId}
          startDate={startDate}
          endDate={endDate}
          rangeLabel={rangeLabel}
          comparisonPeriod={comparisonPeriod}
        />
      )}

      {tenantId && (
        <MarketConcentrationStrip
          tenantId={tenantId}
          startDate={startDate}
          endDate={endDate}
          rangeLabel={rangeLabel}
          onStateSelect={(code) => setSelectedState(code)}
        />
      )}

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
              Map loads as you scroll…
            </div>
          }
        >
          <div className="space-y-6 lg:space-y-8">
            <Suspense fallback={null}>
              <TenantGeoHeatmap
                tenantId={tenantId}
                startDate={startDate}
                endDate={endDate}
                rangeLabel={rangeLabel}
                onStateSelect={(code) => setSelectedState(code)}
              />
            </Suspense>
            <Suspense fallback={null}>
              <MetroBreakdownCard tenantId={tenantId} />
            </Suspense>
          </div>
        </BelowFold>
      )}

      <Suspense
        fallback={
          <div
            className="spark-card p-6 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading timeline…
          </div>
        }
      >
        <InsightsTimeline
          tenantId={tenantId || ""}
          filters={filters}
          rangeLabel={rangeLabel}
          selectedState={selectedState}
          onClearState={() => setSelectedState(null)}
        />
      </Suspense>
    </div>
  );
}

/** Legacy `/insights` bookmarks → Dashboard (admin home / client home). */
export default function SparkInsights() {
  const { isClient } = useSparkRole();
  return (
    <Navigate
      to={
        isClient
          ? { pathname: "/client-dashboard", hash: "performance" }
          : { pathname: "/", hash: "performance" }
      }
      replace
    />
  );
}
