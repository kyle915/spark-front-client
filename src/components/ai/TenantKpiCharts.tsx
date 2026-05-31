import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart as ChartMixed } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { useThemeMode } from "@/hooks/useThemeMode";
import { TenantKpisQuery } from "@/api/queries/TenantKpisQuery";
import type { TenantKpisQuery as TenantKpisQueryType } from "@api/queries/__generated__/TenantKpisQuery.graphql";

/**
 * Phase 1 KPI panel for the dashboards.
 *
 * Loads `tenantKpis` for ONE client (tenant) and renders two things, dark-theme
 * styled to match the workspace:
 *   1. headline KPI stat tiles — consumers reached, samples distributed,
 *      products sold, total engagements, first-time / brand-aware / willing-to-
 *      purchase consumers, and
 *   2. a 12-month trend chart (recaps / engagements / samples) from
 *      `monthlyTrend`.
 *
 * Mounted on both dashboards (admin DashboardEvent and the client
 * SparkClientDashboard) scoped to the active tenant via `useAuthStore()
 * .tenantId`, the same id every per-tenant surface uses. The caller renders
 * nothing when no tenant is in scope; this component itself is wrapped in a
 * <Suspense> by the dashboard (same as the other lazy-loaded dashboard cards),
 * so it loads the data the app's usual way rather than firing on a click.
 *
 * Empty state: when the tenant has no activity yet (all headline totals zero)
 * we show a quiet "No activity yet" card instead of a wall of zeros and an
 * empty chart.
 */

// Reuse the exact chart.js registration the existing dashboard trend chart
// (MonthlyTrendsSection) uses, so we don't register anything new.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

type MonthRow = {
  month: string;
  recaps: number;
  engagements: number;
  samples: number;
};

const fmt = (n: number) => n.toLocaleString();

/* ───────────────────────── trend chart ───────────────────────── */

const TrendChart: React.FC<{ data: readonly MonthRow[] }> = ({ data }) => {
  const [isDark] = useThemeMode();

  const { textColor, gridColor } = useMemo(
    () => ({
      textColor: isDark ? "#e5e7eb" : "#1f2937",
      gridColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    }),
    [isDark],
  );

  const chartData: ChartData<"bar" | "line"> = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        type: "bar",
        label: "Engagements",
        data: data.map((d) => d.engagements),
        backgroundColor: "rgba(95,184,239,0.85)",
        borderRadius: 6,
        yAxisID: "y1",
      },
      {
        type: "bar",
        label: "Samples",
        data: data.map((d) => d.samples),
        backgroundColor: "rgb(109,78,195)",
        borderRadius: 6,
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Recaps",
        data: data.map((d) => d.recaps),
        borderColor: "rgb(197,245,70)",
        pointBackgroundColor: "rgb(197,245,70)",
        borderWidth: 3,
        tension: 0.35,
        yAxisID: "y1",
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { color: textColor, font: { size: 12 } },
      },
    },
    scales: {
      y1: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  };

  return (
    <div style={{ height: 280 }}>
      <ChartMixed
        key={isDark ? "dark" : "light"}
        type="bar"
        data={chartData}
        options={options}
      />
    </div>
  );
};

/* ───────────────────────── stat tile ───────────────────────── */

const StatTile: React.FC<{
  label: string;
  value: string;
  tone: "lime" | "sky" | "gold" | "purple";
}> = ({ label, value, tone }) => {
  const toneColor: Record<string, string> = {
    lime: "var(--spark-lime)",
    sky: "var(--spark-sky)",
    gold: "var(--spark-gold)",
    purple: "var(--spark-purple)",
  };
  return (
    <div
      className="spark-card rounded-2xl px-4 py-4"
      style={{ borderTop: `2px solid ${toneColor[tone]}` }}
    >
      <p
        className="mono text-[9px]"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        className="display tab-num font-bold mt-1.5"
        style={{
          fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: "var(--spark-text)",
        }}
      >
        {value}
      </p>
    </div>
  );
};

/* ───────────────────────── panel ───────────────────────── */

const TenantKpiCharts: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<TenantKpisQueryType>(
    TenantKpisQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const kpis = data?.tenantKpis;

  const tiles = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Consumers reached", value: fmt(kpis.consumersReached), tone: "lime" as const },
      { label: "Samples distributed", value: fmt(kpis.samplesDistributed), tone: "lime" as const },
      { label: "Products sold", value: fmt(kpis.productsSold), tone: "gold" as const },
      { label: "Total engagements", value: fmt(kpis.totalEngagements), tone: "sky" as const },
      { label: "First-time consumers", value: fmt(kpis.firstTimeConsumers), tone: "purple" as const },
      { label: "Brand-aware", value: fmt(kpis.brandAwareConsumers), tone: "sky" as const },
      { label: "Willing to purchase", value: fmt(kpis.willingToPurchase), tone: "gold" as const },
    ];
  }, [kpis]);

  if (!kpis) return null;

  const trend = kpis.monthlyTrend ?? [];

  // All-zero / empty: a brand-new tenant with nothing logged yet. Show a quiet
  // empty state rather than a grid of zeros and a blank chart.
  const hasActivity =
    kpis.events > 0 ||
    kpis.recaps > 0 ||
    kpis.consumersReached > 0 ||
    kpis.samplesDistributed > 0 ||
    kpis.productsSold > 0 ||
    kpis.totalEngagements > 0;

  const hasTrend = trend.some(
    (m) => m.recaps > 0 || m.engagements > 0 || m.samples > 0,
  );

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Program KPIs
        </h2>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          {kpis.events > 0 ? `${fmt(kpis.events)} EVENTS · ${fmt(kpis.recaps)} RECAPS` : "ALL TIME"}
        </p>
      </div>

      {!hasActivity ? (
        <p
          className="text-sm py-10 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No activity yet. KPIs show up here as events and recaps come in.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <StatTile
                key={t.label}
                label={t.label}
                value={t.value}
                tone={t.tone}
              />
            ))}
          </div>

          <div className="mt-6">
            <p
              className="mono text-[10px] mb-3"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              MONTHLY TREND · RECAPS / ENGAGEMENTS / SAMPLES
            </p>
            {hasTrend ? (
              <TrendChart data={trend} />
            ) : (
              <p
                className="text-sm py-8 text-center"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No monthly trend data yet.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TenantKpiCharts;
