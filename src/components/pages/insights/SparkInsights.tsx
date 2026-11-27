import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import DashboardProgramSwitch from "@/field/DashboardProgramSwitch";
import FieldMarketingScorecard from "@/field/FieldMarketingScorecard";
import { isTorchTenant } from "@/field/torch";
import { useDashboardProgram } from "@/field/useDashboardProgram";
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
import ExecutiveInsightsStrip from "@/components/insights/ExecutiveInsightsStrip";
import WeeklySummaryCard from "@/components/ai/WeeklySummaryCard";
import StoreInsightsCards from "@/components/ai/StoreInsightsCards";
import WhatChangedLine from "@/components/explain/WhatChangedLine";
import Callouts from "@/components/explain/Callouts";
import { LatestMonthHighlight } from "@/components/explain/MonthHighlight";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { PanelSkeleton } from "@/layout/PageSkeletons";
import { CountReel } from "@/motion/CountReel";
import { cleanEventName, formatTimelineDay, timelineKind } from "@/utils/eventLabel";
import {
  buildProgramPulseCopy,
  buildProgramPulseOneLiner,
} from "@/components/insights/programPulseCopy";
import MarketConcentrationStrip from "@/components/insights/MarketConcentrationStrip";
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
const ConsumersPerWeekTrend = lazy(() =>
  import("@/components/charts/ConsumerCharts").then((m) => ({
    default: m.ConsumersPerWeekTrend,
  })),
);
const ConsumersByStore = lazy(() =>
  import("@/components/charts/ConsumerCharts").then((m) => ({
    default: m.ConsumersByStore,
  })),
);
const ConsumersByState = lazy(() =>
  import("@/components/charts/ConsumerCharts").then((m) => ({
    default: m.ConsumersByState,
  })),
);
const SamplesByProduct = lazy(() =>
  import("@/components/charts/ConsumerCharts").then((m) => ({
    default: m.SamplesByProduct,
  })),
);
const ConsumersPerEvent = lazy(() =>
  import("@/components/charts/ConsumerCharts").then((m) => ({
    default: m.ConsumersPerEvent,
  })),
);
const FeedbackThemes = lazy(() => import("@/components/charts/FeedbackThemes"));
const CompetitorMentions = lazy(() =>
  import("@/components/charts/CommentInsights").then((m) => ({
    default: m.CompetitorMentions,
  })),
);
const ProductRegions = lazy(() =>
  import("@/components/charts/CommentInsights").then((m) => ({
    default: m.ProductRegions,
  })),
);
const MentionTrends = lazy(() => import("@/components/charts/MentionTrends"));
const OnShelfSummary = lazy(() => import("@/components/charts/OnShelfSummary"));
const TenantKpiComparison = lazy(
  () => import("@/components/ai/TenantKpiComparison"),
);
const TenantInsightsPanel = lazy(
  () => import("@/components/ai/TenantInsightsPanel"),
);
const TenantGeoHeatmap = lazy(() => import("@/components/ai/TenantGeoHeatmap"));
const MetroBreakdownCard = lazy(
  () => import("@/components/pages/dashboard-event/MetroBreakdownCard"),
);

type RangeKey = "7d" | "30d" | "qtd" | "ytd";
type ChartStageKey = "velocity" | "stores" | "states" | "skus";

const CHART_STAGE_TABS: readonly { key: ChartStageKey; label: string }[] = [
  { key: "velocity", label: "Weekly Velocity" },
  { key: "stores", label: "Top Stores" },
  { key: "states", label: "By State" },
  { key: "skus", label: "SKU Mix" },
];

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
  other: "rgba(var(--spark-ink-rgb),0.45)",
};

const MUTED_BUCKET = "rgba(var(--spark-ink-rgb),0.35)";

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
  const total = display.reduce((sum, b) => sum + b.count, 0);
  const zeroCount = display.filter((b) => b.count === 0).length;
  /** Demote when mostly empty — don't compete with real KPI lime. */
  const demoted = total === 0 || zeroCount >= Math.max(1, display.length - 1);

  return (
    <div
      className="spark-card p-6 lg:p-8"
      style={{
        borderRadius: 22,
        opacity: demoted ? 0.62 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{
            letterSpacing: "-0.02em",
            color: demoted ? "rgba(var(--spark-ink-rgb),0.65)" : undefined,
          }}
        >
          By activation type
        </h2>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta)",
          }}
        >
          CONFIRMED + COMPLETED · {rangeLabel.toUpperCase()}
          {demoted ? " · MOSTLY QUIET" : ""}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {display.map((s) => {
          const active = s.count > 0;
          const color = active
            ? (BUCKET_COLORS[s.key] ?? BUCKET_COLORS.other)
            : MUTED_BUCKET;
          return (
            <div
              key={s.key}
              style={{ opacity: active ? 1 : 0.5 }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="spark-dot"
                  style={{
                    background: color,
                    boxShadow: active ? `0 0 8px ${color}` : "none",
                  }}
                />
                <p className="label-mini">{s.label.toUpperCase()}</p>
              </div>
              <p
                className="display tab-num font-bold"
                style={{
                  fontSize: demoted ? "2rem" : "2.5rem",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  color,
                }}
              >
                <CountReel value={s.count} />
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
    )
      .toPromise()
      .catch(() => null),
    fetchQuery<TenantGoalsQueryType>(
      environment,
      TenantGoalsQuery,
      { tenantId, year: null },
      { fetchPolicy: "store-or-network" },
    )
      .toPromise()
      .catch(() => null),
    fetchQuery<TenantConversionKpisQueryType>(
      environment,
      TenantConversionKpisQuery,
      { tenantId, startDate, endDate },
      { fetchPolicy: "store-or-network" },
    )
      .toPromise()
      .catch(() => null),
    fetchQuery<TenantActivationBreakdownQueryType>(
      environment,
      TenantActivationBreakdownQuery,
      { tenantId, startDate, endDate },
      { fetchPolicy: "store-or-network" },
    )
      .toPromise()
      .catch(() => null),
    fetchQuery<TenantSkuPulseQueryType>(
      environment,
      TenantSkuPulseQuery,
      { tenantId, startDate, endDate },
      { fetchPolicy: "store-or-network" },
    )
      .toPromise()
      .catch(() => null),
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
              color: "var(--spark-text-meta)",
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
          color: "var(--spark-text-meta)",
        }}
      >
        SHOWING {rangeLabel.toUpperCase()}
        {selectedState ? ` · ${selectedState}` : ""}
      </p>

      {timelineRows.length === 0 ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "var(--spark-text-meta)" }}
        >
          {selectedState
            ? `No events in ${selectedState} in this range.`
            : "No events in this range. Pick a longer range to see more."}
        </p>
      ) : (
        <div>
          {timelineRows.slice(0, 10).map((e, i) => {
            // The server places each event on its ops-calendar day and says
            // where it sits (Upcoming / Today / Recapped / Recap pending).
            // Don't re-derive it from `new Date("YYYY-MM-DD")`, which is UTC
            // midnight and lands on the previous day across the US.
            const kind = timelineKind(e.status);
            const isToday = kind === "today";
            const isPast = kind === "past";
            const dateStr = formatTimelineDay(e.date);
            const dot = isToday
              ? "var(--spark-lime)"
              : isPast
                ? "rgba(var(--spark-ink-rgb),0.3)"
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
                    {cleanEventName(e.name) || "Untitled"}
                  </p>
                  <p
                    className="mono text-[10px] mt-0.5 truncate"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                      textTransform: "uppercase",
                    }}
                  >
                    {e.location ?? ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="text-sm"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {dateStr || "—"}
                  </p>
                  <p
                    className="text-xs"
                    style={{
                      color: isToday
                        ? "var(--spark-lime)"
                        : isPast
                          ? "rgba(var(--spark-ink-rgb),0.45)"
                          : "var(--spark-sky)",
                    }}
                  >
                    {e.status || (isToday ? "Today" : isPast ? "Done" : "Upcoming")}
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
  omitNarration = false,
}: {
  embedded?: boolean;
  /** Client home renders the weekly summary above Performance itself. */
  omitNarration?: boolean;
}) {
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const torch = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [range, setRange] = useState<RangeKey>("30d");
  const [chartStageTab, setChartStageTab] = useState<ChartStageKey>("velocity");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [copying, setCopying] = useState(false);
  const { program, choose: chooseProgram } = useDashboardProgram(torch);
  const fieldProgram = program === "field";

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
    // Local calendar date, not the UTC one: toISOString() rolls to tomorrow
    // after 5 PM Pacific, which asked for a range ending a day late.
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  const programSwitch = torch ? (
    <DashboardProgramSwitch program={program} onChange={chooseProgram} />
  ) : null;

  const rangeControls = (
    <div className="flex items-center gap-2 flex-wrap">
      {programSwitch}
      {fieldProgram ? null : (
      <>
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
      <button
        type="button"
        onClick={onCopySummary}
        disabled={!tenantId || copying}
        className="px-3 py-2 rounded-xl text-sm font-medium"
        style={{
          background: "transparent",
          color: "var(--spark-text-secondary)",
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
        className="px-3 py-2 rounded-xl text-sm font-medium"
        style={{
          background: "transparent",
          color: "var(--spark-text-secondary)",
          border: "1px solid var(--spark-border)",
        }}
      >
        Open reports
      </button>
      </>
      )}
    </div>
  );

  const showingLine =
    fieldProgram ? null : (
      <p
        className="mono text-[10px] min-w-0 whitespace-normal"
        style={{
          letterSpacing: "0.16em",
          color: "var(--spark-text-meta)",
        }}
      >
        SHOWING {rangeLabel.toUpperCase()} · {startDate} → {endDate}
        {selectedState ? ` · STATE ${selectedState}` : ""}
      </p>
    );

  const rangePills = fieldProgram ? null : (
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
  );

  const stickyRangeBar = (
    <div className="spark-insights-range sticky z-20 overflow-visible">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {programSwitch}
        {rangePills}
        {showingLine}
      </div>
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
        stickyRangeBar
      ) : (
        <div className="flex flex-col gap-3">
          <SparkPageHeader
            eyebrow={fieldProgram ? "FIELD MARKETING" : "PROGRAM ANALYTICS"}
            title="Dashboard"
            titleClassName="text-2xl lg:text-3xl font-bold"
            support={
              fieldProgram
                ? "Monthly scorecard from logged field events. Retail sampling stays on the other tab."
                : "Page range scopes Timeline, Activation, and geo. Program KPIs stay calendar-year."
            }
          />
          <div className="w-full min-w-0">{rangeControls}</div>
          {showingLine}
        </div>
      )}

      {fieldProgram ? <FieldMarketingScorecard /> : null}

      {!fieldProgram ? (
      <>
      {/* One band: executive one-liner + supporting tiles + one chart.
          Everything heavier sits behind More detail so the first paint is
          a single answer instead of a wall of panels. */}
      {tenantId && (
        <div className="spark-card overflow-hidden" style={{ borderRadius: 22 }}>
          <div className="p-5 lg:p-6">
            <ExecutiveInsightsStrip
              tenantId={tenantId}
              startDate={startDate}
              endDate={endDate}
              rangeLabel={rangeLabel}
              comparisonPeriod={comparisonPeriod}
              chromeless
              detail={showDetail}
            />
            <WhatChangedLine
              tenantId={tenantId}
              startDate={startDate}
              endDate={endDate}
              className="mt-4"
            />
            <Callouts
              tenantId={tenantId}
              startDate={startDate}
              endDate={endDate}
              className="mt-5"
            />
            <LatestMonthHighlight tenantId={tenantId} className="mt-5" />
          </div>
          <div style={{ borderTop: "1px solid var(--spark-border)" }} />
          <div className="p-5 lg:p-6">
            <Suspense fallback={<PanelSkeleton label="Loading program KPIs" />}>
              <TenantKpiCharts
                tenantId={tenantId}
                scopeNote={`Calendar ${kpiYear} · not scoped to ${rangeLabel}`}
                chromeless
              />
            </Suspense>
          </div>
        </div>
      )}

      {tenantId && !omitNarration && <WeeklySummaryCard tenantId={tenantId} />}

      {/* Tabbed analytical stage paired alongside Next Moves (StoreInsightsCards) */}
      {tenantId && (
        <div
          className={
            !omitNarration
              ? "grid gap-6 grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start"
              : "space-y-6"
          }
        >
          <section
            className="spark-card p-5 lg:p-6 space-y-5"
            style={{ borderRadius: 22 }}
            aria-label="Sampling analytics stage"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  Approved recaps ·{" "}
                  {chartStageTab === "velocity"
                    ? "12-week trend"
                    : `${startDate} to ${endDate}`}
                </p>
                <h2
                  className="display text-lg font-semibold mt-0.5"
                  style={{ color: "var(--spark-text)" }}
                >
                  Sampling velocity &amp; mix
                </h2>
              </div>
              <div
                className="pill-group max-w-full overflow-x-auto"
                role="tablist"
                aria-label="Chart views"
              >
                {CHART_STAGE_TABS.map((tab) => {
                  const active = chartStageTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setChartStageTab(tab.key)}
                      className={`pill-btn whitespace-nowrap ${active ? "on" : ""}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Suspense fallback={<PanelSkeleton label="Loading chart" />}>
              {chartStageTab === "velocity" ? (
                <ConsumersPerWeekTrend tenantId={tenantId} />
              ) : (
                <div className="space-y-5">
                  <ConsumersPerEvent
                    tenantId={tenantId}
                    startDate={startDate}
                    endDate={endDate}
                  />
                  {chartStageTab === "stores" ? (
                    <ConsumersByStore
                      tenantId={tenantId}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  ) : chartStageTab === "states" ? (
                    <ConsumersByState
                      tenantId={tenantId}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  ) : (
                    <SamplesByProduct
                      tenantId={tenantId}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  )}
                </div>
              )}
            </Suspense>
          </section>

          {!omitNarration ? <StoreInsightsCards tenantId={tenantId} /> : null}
        </div>
      )}

      {/* Pace, markets, year-over-year, AI, geo, and the timeline. Gated on
          state rather than <details> so none of their queries fire until
          someone actually asks for the detail. */}
      {tenantId && (
        <div>
          <button
            type="button"
            aria-expanded={showDetail}
            onClick={() => setShowDetail((v) => !v)}
            className="spark-card w-full px-5 py-4 flex items-center justify-between text-left"
            style={{ borderRadius: 18 }}
          >
            <span>
              <span
                className="text-xs font-medium block"
                style={{
                  color: "var(--spark-text-meta)",
                }}
              >
                More detail
              </span>
              <span className="block text-sm font-semibold mt-0.5">
                What consumers said, competitor mentions, shelf presence, pace to goal, year-over-year, and timeline
              </span>
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {showDetail ? "Hide" : "Show"}
            </span>
          </button>
        </div>
      )}

      {tenantId && showDetail && (
        <div className="space-y-6 lg:space-y-8">

          {/* What consumers said in the same dates, grouped into themes.
              Sits behind More detail, so the grouping is only asked for
              when someone opens it. */}
          <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
            <Suspense fallback={null}>
              <FeedbackThemes
                tenantId={tenantId}
                startDate={startDate}
                endDate={endDate}
              />
            </Suspense>
          </div>

          {/* Read from the same comments: the other brands people named,
              and which product leads in which state. */}
          <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
            <Suspense fallback={null}>
              <CompetitorMentions
                tenantId={tenantId}
                startDate={startDate}
                endDate={endDate}
              />
            </Suspense>
          </div>
          {/* The same comments month by month: which themes and other
              brands come up, and whether they are rising or falling. Its own
              six months, not the range above. */}
          <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
            <Suspense fallback={null}>
              <MentionTrends tenantId={tenantId} />
            </Suspense>
          </div>
          <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
            <Suspense fallback={null}>
              <ProductRegions
                tenantId={tenantId}
                startDate={startDate}
                endDate={endDate}
              />
            </Suspense>
          </div>
          {/* On shelf, from shelf photos on approved retail recaps. Renders
              its own card, and nothing when there are no shelf photos. */}
          <Suspense fallback={null}>
            <OnShelfSummary tenantId={tenantId} startDate={startDate} endDate={endDate} />
          </Suspense>

          <PaceToGoalHero tenantId={tenantId} />

          <MarketConcentrationStrip
            tenantId={tenantId}
            startDate={startDate}
            endDate={endDate}
            rangeLabel={rangeLabel}
            onStateSelect={(code) => setSelectedState(code)}
          />

          <Suspense fallback={<PanelSkeleton />}>
            <TenantKpiComparison
              tenantId={tenantId}
              period={comparisonPeriod}
              scopeNote={`Complete calendar ${comparisonPeriod}s · closest to ${rangeLabel}`}
            />
          </Suspense>

          <Suspense fallback={<PanelSkeleton />}>
            <TenantInsightsPanel
              tenantId={tenantId}
              startDate={startDate}
              endDate={endDate}
            />
          </Suspense>

          <Suspense fallback={<PanelSkeleton />}>
            <ActivationBreakdown
              tenantId={tenantId}
              startDate={startDate}
              endDate={endDate}
              rangeLabel={rangeLabel}
            />
          </Suspense>

          <BelowFold
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Map loads as you scroll…
              </div>
            }
          >
            <div className="space-y-6 lg:space-y-8">
              <Suspense fallback={<PanelSkeleton />}>
                <TenantGeoHeatmap
                  tenantId={tenantId}
                  startDate={startDate}
                  endDate={endDate}
                  rangeLabel={rangeLabel}
                  onStateSelect={(code) => setSelectedState(code)}
                />
              </Suspense>
              <Suspense fallback={<PanelSkeleton />}>
                <MetroBreakdownCard tenantId={tenantId} />
              </Suspense>
            </div>
          </BelowFold>

          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Loading timeline…
              </div>
            }
          >
            <InsightsTimeline
              tenantId={tenantId}
              filters={filters}
              rangeLabel={rangeLabel}
              selectedState={selectedState}
              onClearState={() => setSelectedState(null)}
            />
          </Suspense>
        </div>
      )}
      </>
      ) : null}
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
