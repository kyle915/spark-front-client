import { useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
  type Plugin,
} from "chart.js";
import { Chart as ChartMixed } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import { sparkChartOptions } from "@/lib/chartTheme";
import { TenantKpisQuery } from "@/api/queries/TenantKpisQuery";
import type { TenantKpisQuery as TenantKpisQueryType } from "@api/queries/__generated__/TenantKpisQuery.graphql";
import { collapseSamplingKpis } from "@/lib/collapseSamplingKpis";
import { CountReel } from "@/motion/CountReel";

/**
 * Phase 1 KPI panel for the dashboards.
 *
 * Loads `tenantKpis` for ONE client (tenant) and renders two things, dark-theme
 * styled to match the workspace:
 *   1. headline KPI stat tiles — consumers reached, samples distributed,
 *      products sold, total engagements, first-time / brand-aware / willing-to-
 *      purchase consumers, and
 *   2. a 12-month trend chart from `monthlyTrend`: recaps on the right axis,
 *      and the bars the server names in `trendSeries` on the left.
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
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
);

type MonthRow = {
  month: string;
  recaps: number;
  engagements: number;
  samples: number;
  consumersSampled: number;
  unitsSold: number;
};

type TrendSeries = { key: string; label: string };

const DEFAULT_SERIES: readonly TrendSeries[] = [
  { key: "engagements", label: "Engagements" },
  { key: "samples", label: "Samples" },
];

const SERIES_COLORS = ["rgba(95,184,239,0.85)", "rgba(239,90,42,0.85)"];

const seriesValue = (row: MonthRow, key: string): number =>
  Number((row as Record<string, unknown>)[key]) || 0;

const fmt = (n: number) => n.toLocaleString();

/** Months with any activity but under 15% of the peak look sparse — annotate. */
const sparseMonthFlags = (
  data: readonly MonthRow[],
  series: readonly TrendSeries[],
): boolean[] => {
  const peaks = data.map(
    (d) => Math.max(d.recaps, ...series.map((s) => seriesValue(d, s.key))) || 0,
  );
  const peak = Math.max(...peaks, 0);
  if (peak <= 0) return data.map(() => false);
  return data.map((_, i) => {
    const m = peaks[i];
    return m > 0 && m < peak * 0.15;
  });
};

/** Lightweight canvas note for sparse early months — no datalabels dep. */
const sparseMonthPlugin = (flags: boolean[]): Plugin<"bar" | "line"> => ({
  id: "sparseMonthAnnotate",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale || !chartArea) return;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    flags.forEach((sparse, i) => {
      if (!sparse) return;
      const x = xScale.getPixelForValue(i);
      ctx.fillText("sparse", x, chartArea.bottom - 4);
    });
    ctx.restore();
  },
});

/* ───────────────────────── trend chart ───────────────────────── */

const TrendChart: React.FC<{
  data: readonly MonthRow[];
  series: readonly TrendSeries[];
  note?: string | null;
}> = ({ data, series, note }) => {
  const sparseFlags = useMemo(
    () => sparseMonthFlags(data, series),
    [data, series],
  );
  const sparseCount = sparseFlags.filter(Boolean).length;

  const chartData: ChartData<"bar" | "line"> = {
    labels: data.map((d) => d.month),
    datasets: [
      ...series.map((s, i) => ({
        type: "bar" as const,
        label: s.label,
        data: data.map((d) => seriesValue(d, s.key)),
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
        borderRadius: 6,
        yAxisID: "y1",
      })),
      {
        type: "line",
        label: "Recaps",
        data: data.map((d) => d.recaps),
        borderColor: "rgb(197,245,70)",
        pointBackgroundColor: "rgb(197,245,70)",
        borderWidth: 3,
        tension: 0.35,
        yAxisID: "y2",
      },
    ],
  };

  const options = sparkChartOptions<"bar" | "line">({
    scales: {
      y1: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        title: {
          display: true,
          text: series.map((s) => s.label).join(" / "),
        },
      },
      y2: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { drawOnChartArea: false },
        title: {
          display: true,
          text: "Recaps",
        },
      },
      x: {},
    },
  });

  return (
    <div>
      <div style={{ height: 280 }}>
        <ChartMixed
          type="bar"
          data={chartData}
          options={options}
          plugins={[sparseMonthPlugin(sparseFlags)]}
        />
      </div>
      {sparseCount > 0 && (
        <p
          className="mono text-[10px] mt-2"
          style={{
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {sparseCount} early / light month{sparseCount === 1 ? "" : "s"} marked
          sparse — low volume vs peak; % swings may mislead.
        </p>
      )}
      {note && (
        <p
          className="mono text-[10px] mt-2"
          style={{
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {note}
        </p>
      )}
    </div>
  );
};

/* ───────────────────────── stat tile ───────────────────────── */

const StatTile: React.FC<{
  label: string;
  value: string;
  count?: number;
  sub?: string;
  tone: "lime" | "sky" | "gold" | "purple";
}> = ({ label, value, count, sub, tone }) => {
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
        {typeof count === "number" ? <CountReel value={count} /> : value}
      </p>
      {sub && (
        <p
          className="text-[11px] mt-1 leading-snug"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
};

/* ───────────────────────── year dropdown ───────────────────────── */

// "All time" is modelled as null (trailing-12-month / all-time view on the
// backend); a real year selects that calendar year's totals + Jan→current-month
// (current year) or Jan→Dec (past year).
type YearChoice = number | null;

const YEAR_ALL = "all" as const;

const useYearOptions = () =>
  useMemo(() => {
    const now = new Date().getFullYear();
    return [
      { value: String(now), label: "This year", year: now as YearChoice },
      {
        value: String(now - 1),
        label: "Last year",
        year: (now - 1) as YearChoice,
      },
      { value: YEAR_ALL, label: "All time", year: null as YearChoice },
    ];
  }, []);

/* ───────────────────────── panel ───────────────────────── */

const TenantKpiCharts: React.FC<{
  tenantId: string;
  /** Honest label when a page-level range does not drive this year API. */
  scopeNote?: string;
}> = ({ tenantId, scopeNote }) => {
  const yearOptions = useYearOptions();
  // Default = This year (current calendar year). The selected value drives the
  // query variable below, so changing it refetches via useLazyLoadQuery.
  const [yearValue, setYearValue] = useState<string>(yearOptions[0].value);
  const selectedYear: YearChoice =
    yearOptions.find((o) => o.value === yearValue)?.year ?? null;

  const data = useLazyLoadQuery<TenantKpisQueryType>(
    TenantKpisQuery,
    { tenantId, year: selectedYear },
    { fetchPolicy: "store-or-network" },
  );

  const kpis = data?.tenantKpis;

  const tiles = useMemo((): {
    label: string;
    value: string;
    count?: number;
    sub?: string;
    tone: "lime" | "sky" | "gold" | "purple";
  }[] => {
    if (!kpis) return [];
    const program = kpis.program;
    if (program) {
      // Retail-sales programs (Torch): the Conversion tile's recap set — no
      // engagements, units sold = cans + packs at 1 each.
      const audience = [
        {
          label: "First-time consumers",
          value: program.firstTimeConsumers,
          tone: "purple" as const,
        },
        {
          label: "Brand-aware",
          value: program.brandAwareConsumers,
          tone: "sky" as const,
        },
        {
          label: "Willing to purchase",
          value: program.willingToPurchase,
          tone: "gold" as const,
        },
      ]
        .filter((t) => t.value > 0)
        .map((t) => ({ ...t, value: fmt(t.value), count: t.value }));
      return [
        {
          label: "Consumers sampled",
          value: fmt(program.consumersSampled),
          count: program.consumersSampled,
          sub:
            program.dryDemos > 0
              ? `${fmt(program.demos)} demos · incl. ${fmt(program.dryDemos)} dry (${fmt(program.dryPeopleEngaged)} people engaged)`
              : `${fmt(program.demos)} demos`,
          tone: "lime" as const,
        },
        {
          label: "Units sold",
          value: fmt(program.unitsSold),
          count: program.unitsSold,
          sub: `${fmt(program.cansSold)} cans · ${fmt(program.packsSold)} packs`,
          tone: "gold" as const,
        },
        {
          label: "Conversion",
          value:
            program.conversionPct == null ? "—" : `${program.conversionPct}%`,
          sub:
            program.dryDemos > 0
              ? "Units sold ÷ consumers sampled · dry demos ÷ people engaged"
              : "Units sold ÷ consumers sampled",
          tone: "sky" as const,
        },
        ...audience,
      ];
    }
    // Core metrics every tenant tracks — always shown, even at 0 (a real 0 is
    // meaningful here). The consumer-signal metrics below are template-
    // dependent: a bread tenant (Stone House Bread) never collects brand
    // awareness / first-time, so those come back 0 — hide them rather than
    // show empty tiles (per kyle's "if we're not tracking it, delete it").
    const sampling = collapseSamplingKpis({
      consumersReached: kpis.consumersReached,
      samplesDistributed: kpis.samplesDistributed,
      totalEngagements: kpis.totalEngagements,
    }).map((t) => ({
      label: t.label,
      value: fmt(t.value),
      count: t.value,
      tone: (t.key === "totalEngagements" ? "sky" : "lime") as "lime" | "sky",
    }));
    const core = [
      ...sampling,
      {
        label: "Products sold",
        value: fmt(kpis.productsSold),
        count: kpis.productsSold,
        tone: "gold" as const,
      },
    ];
    const optional = [
      {
        label: "First-time consumers",
        value: kpis.firstTimeConsumers,
        tone: "purple" as const,
      },
      {
        label: "Brand-aware",
        value: kpis.brandAwareConsumers,
        tone: "sky" as const,
      },
      {
        label: "Willing to purchase",
        value: kpis.willingToPurchase,
        tone: "gold" as const,
      },
    ]
      .filter((t) => t.value > 0)
      .map((t) => ({
        label: t.label,
        value: fmt(t.value),
        count: t.value,
        tone: t.tone,
      }));
    return [...core, ...optional];
  }, [kpis]);

  if (!kpis) return null;

  const trend = kpis.monthlyTrend ?? [];
  const series: readonly TrendSeries[] = kpis.trendSeries?.length
    ? kpis.trendSeries
    : DEFAULT_SERIES;
  const seriesTitle = series.map((s) => s.label.toUpperCase());

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
    (m) => m.recaps > 0 || series.some((s) => seriesValue(m, s.key) > 0),
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
        <div className="flex items-center gap-3 flex-wrap">
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            {scopeNote
              ? scopeNote.toUpperCase()
              : kpis.events > 0
                ? `${fmt(kpis.events)} WITH RECAPS · ${fmt(kpis.recaps)} RECAPS`
                : selectedYear === null
                  ? "ALL TIME"
                  : `${selectedYear}`}
          </p>
          {/* Compact year dropdown — drives the $year query variable above, so
              selecting a year refetches the KPI rollup. Default = This year. */}
          <select
            aria-label="KPI time range"
            value={yearValue}
            onChange={(e) => setYearValue(e.target.value)}
            className="mono text-[11px] rounded-lg px-2.5 py-1.5 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              letterSpacing: "0.06em",
            }}
          >
            {yearOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
                count={t.count}
                sub={t.sub}
                tone={t.tone}
              />
            ))}
          </div>

          <div className="mt-6">
            {hasTrend ? (
              <>
                <p
                  className="mono text-[10px] mb-3"
                  style={{
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  MONTHLY TREND · RECAPS (RIGHT) / {seriesTitle.join(" + ")}{" "}
                  (LEFT)
                </p>
                <TrendChart
                  data={trend}
                  series={series}
                  note={kpis.trendNote}
                />
              </>
            ) : (
              <div>
                <p
                  className="mono text-[10px] mb-3"
                  style={{
                    letterSpacing: "0.18em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  MONTHLY TREND · RECAPS / {seriesTitle.join(" / ")}
                </p>
                <div className="spark-chart-empty min-h-[180px]">
                  No monthly trend data yet.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TenantKpiCharts;
