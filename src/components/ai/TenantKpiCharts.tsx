import { useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import "@/lib/sparkChartRegister";
import { Bar, Line } from "react-chartjs-2";
import ChartBlock from "@/components/charts/ChartBlock";
import {
  MAX_SERIES,
  barSeries,
  chartOptions,
  lineSeries,
  seriesColor,
  valueLabels,
} from "@/lib/sparkChart";
import { sparseMonthFlags, splitMonthlyTrend } from "@/lib/chartRows";
import { TenantKpisQuery } from "@/api/queries/TenantKpisQuery";
import type { TenantKpisQuery as TenantKpisQueryType } from "@api/queries/__generated__/TenantKpisQuery.graphql";
import { collapseSamplingKpis } from "@/lib/collapseSamplingKpis";
import { CountReel } from "@/motion/CountReel";
import { inkRgba } from "@/theme/chartInk";
import { useAppearance } from "@/theme/appearance";

/**
 * Phase 1 KPI panel for the dashboards.
 *
 * Loads `tenantKpis` for ONE client (tenant) and renders two things, dark-theme
 * styled to match the workspace:
 *   1. headline KPI stat tiles — consumers reached, samples distributed,
 *      products sold, total engagements, first-time / brand-aware / willing-to-
 *      purchase consumers, and
 *   2. the 12-month trend from `monthlyTrend` as two charts on one month
 *      axis: the measures the server names in `trendSeries`, and recaps.
 *      They are different scales, so they are never drawn on two y-axes.
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

const seriesValue = (row: MonthRow, key: string): number =>
  Number((row as Record<string, unknown>)[key]) || 0;

const fmt = (n: number) => n.toLocaleString();

const lastValue = valueLabels("last");

const NOTE_STYLE = { color: "var(--spark-text-meta)" } as const;

/* ───────────────────────── trend charts ───────────────────────── */

const TrendChart: React.FC<{
  data: readonly MonthRow[];
  series: readonly TrendSeries[];
  note?: string | null;
}> = ({ data, series, note }) => {
  useAppearance();
  const { labels, measures, recaps } = useMemo(
    () => splitMonthlyTrend(data, series.slice(0, MAX_SERIES)),
    [data, series],
  );
  const sparseCount = useMemo(
    () => sparseMonthFlags(data, series).filter(Boolean).length,
    [data, series],
  );
  const several = measures.length > 1;

  return (
    <div className="flex flex-col gap-5">
      <ChartBlock title={`${measures.map((m) => m.label).join(" and ")} by month`} height={220}>
        <Bar
          data={{
            labels,
            datasets: measures.map((m, i) =>
              barSeries({
                label: m.label,
                data: m.data,
                // Colour only tells several measures apart; one is ink.
                color: several ? seriesColor(i) : undefined,
              }),
            ),
          }}
          options={chartOptions<"bar">({ legend: several })}
        />
      </ChartBlock>
      <ChartBlock title="Recaps by month" height={130}>
        <Line
          data={{
            labels,
            datasets: [lineSeries({ label: "Recaps", data: recaps, area: true })],
          }}
          options={chartOptions<"line">()}
          plugins={[lastValue]}
        />
      </ChartBlock>
      {sparseCount > 0 && (
        <p className="text-xs" style={NOTE_STYLE}>
          {sparseCount} light month{sparseCount === 1 ? "" : "s"}: low volume
          against the peak, so percentage swings there can mislead.
        </p>
      )}
      {note && (
        <p className="text-xs" style={NOTE_STYLE}>
          {note}
        </p>
      )}
    </div>
  );
};

/* ───────────────────────── primary + quiet supporting stats ───────────────────────── */

type KpiTile = {
  label: string;
  value: string;
  count?: number;
  sub?: string;
  primary?: boolean;
};

const PrimaryFigure: React.FC<{
  label: string;
  value: string;
  count?: number;
  sub?: string;
}> = ({ label, value, count, sub }) => (
  <div className="spark-kpi-lockup py-1">
    <p className="spark-kpi-label">{label}</p>
    <p className="spark-kpi-value spark-kpi-value-lg">
      {typeof count === "number" ? <CountReel value={count} /> : value}
    </p>
    {sub ? (
      <p
        className="spark-stat-hint"
        style={{ fontSize: "0.8125rem" }}
      >
        {sub}
      </p>
    ) : null}
  </div>
);

const QuietStat: React.FC<{
  label: string;
  value: string;
  count?: number;
  sub?: string;
}> = ({ label, value, count, sub }) => (
  <div className="spark-kpi-lockup min-w-0 px-3 first:pl-0 last:pr-0">
    <p className="spark-kpi-label" style={{ fontSize: "0.75rem" }}>
      {label}
    </p>
    <p className="spark-kpi-value spark-kpi-value-sm">
      {typeof count === "number" ? <CountReel value={count} /> : value}
    </p>
    {sub ? (
      <p className="spark-stat-hint">
        {sub}
      </p>
    ) : null}
  </div>
);

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
  /** Skip outer spark-card when nested in a connected bento. */
  chromeless?: boolean;
}> = ({ tenantId, scopeNote, chromeless = false }) => {
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

  const { primary, supporting } = useMemo((): {
    primary: KpiTile | null;
    supporting: KpiTile[];
  } => {
    if (!kpis) return { primary: null, supporting: [] };
    const program = kpis.program;
    if (program) {
      // Retail-sales programs: conversion is the primary figure when present.
      const audience = [
        {
          label: "First-time consumers",
          value: program.firstTimeConsumers,
        },
        {
          label: "Brand-aware",
          value: program.brandAwareConsumers,
        },
        {
          label: "Willing to purchase",
          value: program.willingToPurchase,
        },
      ]
        .filter((t) => t.value > 0)
        .map((t) => ({ ...t, value: fmt(t.value), count: t.value }));
      const formula =
        program.dryDemos > 0
          ? "Units sold ÷ consumers sampled · dry demos ÷ people engaged"
          : "Units sold ÷ consumers sampled";
      const primary: KpiTile = {
        label: "Conversion",
        value:
          program.conversionPct == null ? "—" : `${program.conversionPct}%`,
        sub: formula,
        primary: true,
      };
      const supporting: KpiTile[] = [
        {
          label: "Consumers sampled",
          value: fmt(program.consumersSampled),
          count: program.consumersSampled,
          sub:
            program.dryDemos > 0
              ? `${fmt(program.demos)} demos · incl. ${fmt(program.dryDemos)} dry (${fmt(program.dryPeopleEngaged)} people engaged)`
              : `${fmt(program.demos)} demos`,
        },
        {
          label: "Units sold",
          value: fmt(program.unitsSold),
          count: program.unitsSold,
          sub: `${fmt(program.cansSold)} cans · ${fmt(program.packsSold)} packs`,
        },
        ...audience,
      ];
      return { primary, supporting };
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
      ...(t.note ? { sub: t.note } : {}),
    }));
    const sold: KpiTile = {
      label: "Products sold",
      value: fmt(kpis.productsSold),
      count: kpis.productsSold,
      primary: true,
    };
    const optional = [
      {
        label: "First-time consumers",
        value: kpis.firstTimeConsumers,
      },
      {
        label: "Brand-aware",
        value: kpis.brandAwareConsumers,
      },
      {
        label: "Willing to purchase",
        value: kpis.willingToPurchase,
      },
    ]
      .filter((t) => t.value > 0)
      .map((t) => ({
        label: t.label,
        value: fmt(t.value),
        count: t.value,
      }));
    return { primary: sold, supporting: [...sampling, ...optional] };
  }, [kpis]);

  if (!kpis) return null;

  const trend = kpis.monthlyTrend ?? [];
  const series: readonly TrendSeries[] = kpis.trendSeries?.length
    ? kpis.trendSeries
    : DEFAULT_SERIES;

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
    <div
      className={chromeless ? undefined : "spark-card p-6 lg:p-8"}
      style={chromeless ? undefined : { borderRadius: 22 }}
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2 className="display text-lg lg:text-xl font-bold">
          Program KPIs
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <p
            className="display text-[12px]"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {scopeNote
              ? scopeNote
              : kpis.events > 0
                ? `${fmt(kpis.events)} with recaps · ${fmt(kpis.recaps)} recaps`
                : selectedYear === null
                  ? "All time"
                  : `${selectedYear}`}
          </p>
          {/* Compact year dropdown — drives the $year query variable above, so
              selecting a year refetches the KPI rollup. Default = This year. */}
          <select
            aria-label="KPI time range"
            value={yearValue}
            onChange={(e) => setYearValue(e.target.value)}
            className="display text-[12px] rounded-lg px-2.5 py-1.5 cursor-pointer"
            style={{
              background: inkRgba(0.04),
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
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
          style={{ color: "var(--spark-text-meta)" }}
        >
          No activity yet. KPIs show up here as events and recaps come in.
        </p>
      ) : (
        <>
          {primary && (
            <PrimaryFigure
              label={primary.label}
              value={primary.value}
              count={primary.count}
              sub={primary.sub}
            />
          )}
          {supporting.length > 0 && (
            <div
              className="mt-5 flex flex-wrap gap-y-4"
              style={{
                borderTop: "1px solid var(--spark-border)",
                paddingTop: 16,
              }}
            >
              {supporting.map((t, i) => (
                <div
                  key={t.label}
                  className="min-w-[140px] flex-1"
                  style={{
                    borderLeft:
                      i === 0 ? "none" : "1px solid var(--spark-border)",
                    paddingLeft: i === 0 ? 0 : 16,
                    marginLeft: i === 0 ? 0 : 4,
                  }}
                >
                  <QuietStat
                    label={t.label}
                    value={t.value}
                    count={t.count}
                    sub={t.sub}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <p
              className="display text-[13px] font-medium mb-3"
              style={{ color: "var(--spark-text)" }}
            >
              Monthly trend
            </p>
            {hasTrend ? (
              <TrendChart data={trend} series={series} note={kpis.trendNote} />
            ) : (
              <div className="spark-chart-empty min-h-[180px]">
                No monthly trend data yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TenantKpiCharts;
