import { Suspense, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Bar, Line } from "react-chartjs-2";
import "@/lib/sparkChartRegister";
import ChartBlock from "@/components/charts/ChartBlock";
import AskAboutChart from "@/components/explain/AskAboutChart";
import ErrorBoundary from "@/components/ErrorBoundary";
import { StoreChartLinks } from "@/components/store/StoreLinks";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import { useConsumerBreakdown, type ConsumerBreakdown } from "@/hooks/useConsumerBreakdown";
import { ConsumersPerEventQuery } from "@/api/queries/ConsumersPerEventQuery";
import type { ConsumersPerEventQuery as ConsumersPerEventQueryType } from "@api/queries/__generated__/ConsumersPerEventQuery.graphql";
import { TenantSkuPulseQuery } from "@/api/queries/TenantSkuPulseQuery";
import type { TenantSkuPulseQuery as TenantSkuPulseQueryType } from "@api/queries/__generated__/TenantSkuPulseQuery.graphql";
import { labelsEveryRow } from "@/lib/chartRows";
import {
  barLabel,
  barTitle,
  contextIndexes,
  lastWeeksWindow,
  perEvent,
  perEventSentence,
  productSplit,
  rankedSplit,
  type RankedSplit,
} from "@/lib/consumerBreakdown";
import {
  alignPriorWeeklyValues,
  computePriorDateWindow,
  metricAxisTitle,
  transformSplitRowsByMetric,
  transformWeeklyByMetric,
  type ReportChartMetric,
} from "@/components/pages/reports/programReportHelpers";
import type { ChartKind } from "@/lib/dashboardExplain";
import type { ChartDataset, ChartOptions, Plugin, TooltipItem } from "chart.js";
import {
  barSeries,
  chartInk,
  chartOptions,
  chartQuiet,
  chartSurface,
  lineSeries,
  valueLabels,
} from "@/lib/sparkChart";
import { computeTypicalWeeksScale } from "@/lib/typicalWeeksScale";
import { useAppearance } from "@/theme/appearance";

const lastValue = valueLabels("last");
const everyValue = valueLabels("all");

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;

const count = (n: number) => n.toLocaleString("en-US");

/** One short sentence where a chart has nothing to draw, under its title. */
const Nothing: React.FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <figure className="m-0">
    <figcaption className="mb-1 text-[13px] font-medium" style={SECONDARY}>
      {title}
    </figcaption>
    <p className="text-sm py-3" style={META}>
      {children}
    </p>
  </figure>
);

type Window = {
  tenantId: string;
  startDate: string;
  endDate: string;
  metric?: ReportChartMetric;
  comparePrior?: boolean;
};

/** Keeps one chart's failed or slow query from taking the page with it. */
const Guard: React.FC<Window & { title: string; height: number; children: ReactNode }> = ({
  title,
  height,
  children,
  tenantId,
  startDate,
  endDate,
}) => (
  <ErrorBoundary
    key={`${tenantId}|${startDate}|${endDate}`}
    fallback={<Nothing title={title}>This chart could not load.</Nothing>}
  >
    <Suspense
      fallback={
        <ChartBlock title={title} height={height}>
          <span className="sr-only">Loading</span>
        </ChartBlock>
      }
    >
      {children}
    </Suspense>
  </ErrorBoundary>
);

/* ───────────────────────── weekly trend ───────────────────────── */

const WEEKLY_HEIGHT = 224;

const WeeklyPlot: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  breakdown: ConsumerBreakdown | null;
  priorBreakdown?: ConsumerBreakdown | null;
  priorShortLabel?: string;
  metric: ReportChartMetric;
  note?: string;
}> = ({
  tenantId,
  startDate,
  endDate,
  breakdown,
  priorBreakdown = null,
  priorShortLabel = "prior window",
  metric,
  note,
}) => {
  const appearance = useAppearance();
  const [focusTypical, setFocusTypical] = useState(false);
  const axisCopy = metricAxisTitle("week", metric);

  const trend = useMemo(
    () => transformWeeklyByMetric(breakdown?.byWeek ?? [], metric),
    [breakdown, metric],
  );

  const alignedPrior = useMemo(() => {
    if (!priorBreakdown) return null;
    const vals = alignPriorWeeklyValues(
      trend.values.length,
      priorBreakdown.byWeek ?? [],
      metric,
    );
    return vals.some((v) => v != null && v > 0) ? vals : null;
  }, [priorBreakdown, trend.values.length, metric]);

  const spikeMeta = useMemo(
    () =>
      metric === "sampled" && !alignedPrior
        ? computeTypicalWeeksScale(trend.values, trend.labels)
        : null,
    [trend.values, trend.labels, metric, alignedPrior],
  );

  const datasets = useMemo<ChartDataset<"line", Array<number | null>>[]>(() => {
    if (!focusTypical || !spikeMeta) {
      const main = lineSeries({
        label: alignedPrior ? "Selected window" : axisCopy.measure,
        data: trend.values,
      });
      if (!alignedPrior) return [main];
      const ghost: ChartDataset<"line", Array<number | null>> = {
        ...lineSeries({
          label: `Prior (${priorShortLabel})`,
          data: alignedPrior,
          quiet: true,
        }),
        borderDash: [4, 4],
      };
      return [main, ghost];
    }
    const baseMain = lineSeries({
      label: axisCopy.measure,
      data: spikeMeta.typicalData,
    });
    const lastTypicalIdx = spikeMeta.typicalData.reduce<number>(
      (acc, val, idx) => (val == null ? acc : idx),
      -1,
    );
    const pointRadii = spikeMeta.typicalData.map((val, idx, arr) => {
      if (val == null) return 0;
      if (idx === lastTypicalIdx) return 4;
      const isolated = arr[idx - 1] == null && arr[idx + 1] == null;
      return isolated ? 3.5 : 0;
    });

    const mainDataset: ChartDataset<"line", Array<number | null>> = {
      ...baseMain,
      spanGaps: false,
      pointRadius: pointRadii,
    };

    const connectorDataset: ChartDataset<"line", Array<number | null>> = {
      label: axisCopy.measure,
      data: spikeMeta.connectorData,
      borderColor: chartQuiet(),
      backgroundColor: chartQuiet(),
      borderWidth: 1.5,
      borderDash: [4, 4],
      tension: 0,
      spanGaps: false,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: trend.values.map((v) =>
        v > spikeMeta.axisMax ? 5 : 0,
      ),
    };

    return [mainDataset, connectorDataset];
  }, [
    focusTypical,
    spikeMeta,
    trend.values,
    alignedPrior,
    priorShortLabel,
    axisCopy.measure,
    appearance,
  ]);

  const cappedPeakPlugin = useMemo<Plugin<"line"> | null>(() => {
    if (!focusTypical || !spikeMeta) return null;
    const rawValues = trend.values;
    const capVal = spikeMeta.axisMax;
    return {
      id: "sparkCappedPeakBadge",
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(1)?.data?.length
          ? chart.getDatasetMeta(1)
          : chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;
        const { ctx, chartArea } = chart;
        const pillBg = chartInk();
        const pillFg = chartSurface();
        ctx.save();
        ctx.font = "600 11px 'Space Grotesk', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        meta.data.forEach((pt, idx) => {
          const raw = rawValues[idx] ?? 0;
          if (raw <= capVal || !pt) return;
          const text = `↑ ${count(raw)}`;
          const padX = 8;
          const pillH = 20;
          const pillW = Math.ceil(ctx.measureText(text).width + padX * 2);
          const halfW = pillW / 2;
          const cx = Math.min(
            Math.max(pt.x, chartArea.left + halfW + 2),
            chartArea.right - halfW - 2,
          );
          const cy = Math.max(pillH / 2 + 2, chartArea.top - pillH / 2 - 4);

          ctx.beginPath();
          ctx.arc(pt.x, chartArea.top, 3, 0, Math.PI * 2);
          ctx.fillStyle = pillBg;
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(cx - halfW, cy - pillH / 2, pillW, pillH, 999);
          ctx.fillStyle = pillBg;
          ctx.fill();

          ctx.fillStyle = pillFg;
          ctx.fillText(text, cx, cy + 0.5);
        });
        ctx.restore();
      },
    };
  }, [focusTypical, spikeMeta, trend.values, appearance]);

  const lineOptions = useMemo(() => {
    const base = chartOptions<"line">({ legend: Boolean(alignedPrior && !focusTypical) });
    if (!focusTypical || !spikeMeta) return base;
    const tooltip = base.plugins?.tooltip;
    const baseYTicks =
      base.scales?.y && "ticks" in base.scales.y ? base.scales.y.ticks : {};
    return {
      ...base,
      layout: {
        ...base.layout,
        padding: {
          ...(typeof base.layout?.padding === "object" ? base.layout.padding : {}),
          top: 28,
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...tooltip,
          filter: (item: TooltipItem<"line">) => {
            const isOutlier =
              (trend.values[item.dataIndex] ?? 0) > spikeMeta.axisMax;
            return isOutlier ? item.datasetIndex === 1 : item.datasetIndex === 0;
          },
          callbacks: {
            ...tooltip?.callbacks,
            label: (item: TooltipItem<"line">) => {
              const raw = trend.values[item.dataIndex] ?? item.parsed.y ?? 0;
              return raw > spikeMeta.axisMax
                ? `${count(raw)} (peak week — above ${count(spikeMeta.axisMax)} scale)`
                : count(raw);
            },
          },
        },
      },
      scales: {
        ...base.scales,
        y: {
          ...base.scales?.y,
          min: 0,
          max: spikeMeta.axisMax,
          ticks: {
            ...baseYTicks,
            stepSize: spikeMeta.stepSize,
          },
        },
      },
    } as ChartOptions<"line">;
  }, [focusTypical, spikeMeta, trend.values, alignedPrior, appearance]);

  if (!breakdown) {
    return <Nothing title={axisCopy.title}>This chart could not load.</Nothing>;
  }
  if (!trend.hasData) {
    return <Nothing title={axisCopy.title}>No approved recaps in these weeks yet.</Nothing>;
  }
  const peakVal = Math.max(0, ...trend.values);
  const tableRows = trend.labels.map((lbl, idx) => ({
    label: lbl,
    value: trend.values[idx] ?? 0,
    secondary: alignedPrior ? (alignedPrior[idx] ?? "—") : undefined,
  }));

  return (
    <div className="flex flex-col gap-2">
      <ChartBlock
        title={axisCopy.title}
        height={WEEKLY_HEIGHT}
        categoryHeader="Week"
        valueHeader={axisCopy.measure}
        secondaryHeader={alignedPrior ? `Prior (${priorShortLabel})` : undefined}
        tableRows={tableRows}
        headerAction={
          spikeMeta ? (
            <div className="pill-group" role="group" aria-label="Y-axis scale">
              <button
                type="button"
                onClick={() => setFocusTypical(false)}
                className={`pill-btn ${!focusTypical ? "on" : ""}`}
              >
                Full scale
              </button>
              <button
                type="button"
                onClick={() => setFocusTypical(true)}
                className={`pill-btn ${focusTypical ? "on" : ""}`}
                title="Zoom Y-axis to typical weekly volume while marking off-scale peak weeks"
              >
                Typical weeks
              </button>
            </div>
          ) : null
        }
      >
        <Line
          key={`${appearance}-${metric}-${Boolean(alignedPrior)}-${focusTypical ? "typical" : "full"}`}
          aria-label={`${axisCopy.title}: ${trend.labels.length} weeks, peak ${count(peakVal)}`}
          data={{
            labels: trend.labels,
            datasets,
          }}
          options={lineOptions}
          plugins={cappedPeakPlugin ? [lastValue, cappedPeakPlugin] : [lastValue]}
        />
      </ChartBlock>
      {focusTypical && spikeMeta ? (
        <p className="text-xs" style={META}>
          Y-axis zoomed to {count(spikeMeta.axisMax)} for typical weeks; peak week (
          {spikeMeta.peakLabel}: {count(spikeMeta.max)}) is badged at the top.
        </p>
      ) : null}
      {note ? (
        <p className="text-xs" style={META}>
          {note}
        </p>
      ) : null}
      <AskAboutChart
        tenantId={tenantId}
        chart="consumers_by_week"
        startDate={startDate}
        endDate={endDate}
        title={axisCopy.title}
      />
    </div>
  );
};

const WeeklySingle: React.FC<Window & { note?: string }> = ({
  tenantId,
  startDate,
  endDate,
  metric = "sampled",
  note,
}) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  return (
    <WeeklyPlot
      tenantId={tenantId}
      startDate={startDate}
      endDate={endDate}
      breakdown={breakdown}
      metric={metric}
      note={note}
    />
  );
};

const WeeklyCompared: React.FC<
  Window & { priorStartDate: string; priorEndDate: string; priorShortLabel: string; note?: string }
> = ({
  tenantId,
  startDate,
  endDate,
  priorStartDate,
  priorEndDate,
  priorShortLabel,
  metric = "sampled",
  note,
}) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const priorBreakdown = useConsumerBreakdown(tenantId, priorStartDate, priorEndDate);
  return (
    <WeeklyPlot
      tenantId={tenantId}
      startDate={startDate}
      endDate={endDate}
      breakdown={breakdown}
      priorBreakdown={priorBreakdown}
      priorShortLabel={priorShortLabel}
      metric={metric}
      note={note}
    />
  );
};

/** The weekly trend for a window the caller picks (the report's dates). */
export const ConsumersPerWeek: React.FC<Window & { note?: string }> = (props) => {
  const axisCopy = metricAxisTitle("week", props.metric ?? "sampled");
  const priorWin = props.comparePrior
    ? computePriorDateWindow(props.startDate, props.endDate)
    : null;
  return (
    <Guard
      title={axisCopy.title}
      height={WEEKLY_HEIGHT}
      tenantId={props.tenantId}
      startDate={props.startDate}
      endDate={props.endDate}
    >
      {priorWin ? (
        <WeeklyCompared
          {...props}
          priorStartDate={priorWin.startDate}
          priorEndDate={priorWin.endDate}
          priorShortLabel={priorWin.shortLabel}
        />
      ) : (
        <WeeklySingle {...props} />
      )}
    </Guard>
  );
};

const TREND_WEEKS = 12;

export const ConsumersPerWeekTrend: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const window = useMemo(() => lastWeeksWindow(TREND_WEEKS), []);
  return (
    <ConsumersPerWeek
      tenantId={tenantId}
      {...window}
      note={`Last ${TREND_WEEKS} completed weeks, from approved recaps. This week is added once it ends.`}
    />
  );
};

/* ───────────────────────── ranked splits ───────────────────────── */

const ROW_HEIGHT = 34;
const splitHeight = (rows: number) => Math.max(96, rows * ROW_HEIGHT + 36);

const RankedSplitChart: React.FC<{
  title: string;
  measure: string;
  split: RankedSplit;
  empty: string;
  noun: string;
  where: string;
  ask: { tenantId: string; startDate: string; endDate: string; chart: ChartKind };
  showFoldedTailNote?: boolean;
  onBarSelect?: (bar: RankedSplit["bars"][number]) => void;
}> = ({
  title,
  measure,
  split,
  empty,
  noun,
  where,
  ask,
  showFoldedTailNote = true,
  onBarSelect,
}) => {
  const { bars, aside } = split;
  const appearance = useAppearance();
  const options = useMemo(() => {
    const base = chartOptions<"bar">({ horizontal: true });
    const tooltip = base.plugins?.tooltip;
    return {
      ...base,
      ...(onBarSelect
        ? {
            onHover: (event, elements) => {
              const target = event.native?.target as HTMLElement | null;
              if (!target) return;
              const hit = elements[0] ? bars[elements[0].index] : null;
              target.style.cursor = hit && !hit.context ? "pointer" : "default";
            },
            onClick: (_event, elements) => {
              const hit = elements[0] ? bars[elements[0].index] : null;
              if (hit && !hit.context) onBarSelect(hit);
            },
          }
        : {}),
      plugins: {
        ...base.plugins,
        tooltip: {
          ...tooltip,
          callbacks: {
            ...tooltip?.callbacks,
            title: (items: TooltipItem<"bar">[]) => {
              const bar = bars[items[0]?.dataIndex ?? -1];
              return bar ? barTitle(bar) : "";
            },
          },
        },
      },
    } as ChartOptions<"bar">;
  }, [bars, appearance, onBarSelect]);
  if (bars.length === 0) return <Nothing title={title}>{empty}</Nothing>;
  if (bars.length === 1 && !aside) {
    const only = bars[0];
    return (
      <Nothing title={title}>
        <span style={{ color: "var(--spark-text)" }}>
          {only.context
            ? `${only.label} for any of the ${count(only.value)}.`
            : `All ${count(only.value)} ${where} ${only.label}.`}
        </span>
      </Nothing>
    );
  }
  const categoryTitle =
    noun === "store" ? "Store" : noun === "state" ? "State" : "Product";
  return (
    <div className="flex flex-col gap-2">
      <ChartBlock
        title={title}
        height={splitHeight(bars.length)}
        categoryHeader={categoryTitle}
        valueHeader={measure}
        tableRows={bars.map((b) => ({
          label: barTitle(b),
          value: b.value,
        }))}
      >
        <Bar
          aria-label={`${title}: top ${bars[0]?.label ?? ""} (${count(bars[0]?.value ?? 0)})`}
          data={{
            labels: bars.map((b) => barLabel(b, b.context ? 28 : 18)),
            datasets: [
              barSeries({
                label: measure,
                data: bars.map((b) => b.value),
                quiet: contextIndexes(bars),
                horizontal: true,
              }),
            ],
          }}
          options={options}
          plugins={labelsEveryRow(bars.length) ? [everyValue] : []}
        />
      </ChartBlock>
      {aside && showFoldedTailNote ? (
        <p className="text-xs" style={META}>
          {aside.count
            ? `The other ${count(aside.count)} ${noun}${aside.count === 1 ? "" : "s"} add ${count(aside.value)}.`
            : `Other ${noun}s add ${count(aside.value)}.`}
        </p>
      ) : null}
      {split.bars.some((b) => b.context && b.label === "No store on the event") ? (
        <p className="text-xs" style={META}>
          No store on the event is approved recaps whose event has no store.
        </p>
      ) : null}
      {split.hasVenue ? (
        <p className="text-xs" style={META}>
          Festivals and event activations are shown by venue, marked (venue).
        </p>
      ) : null}
      <AskAboutChart {...ask} title={title} />
    </div>
  );
};

const PRODUCT_TITLE = "Samples handed out by product";

const StoreInner: React.FC<Window> = ({
  tenantId,
  startDate,
  endDate,
  metric = "sampled",
}) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const axisCopy = metricAxisTitle("store", metric);
  const { split, liftedUnlinked } = useMemo(() => {
    const rawRows = transformSplitRowsByMetric(breakdown?.byStore ?? [], metric);
    const hasNamed = rawRows.some(
      (r) => (r.kind === "named" || r.kind === "venue") && r.consumers > 0,
    );
    const missingTotal = rawRows
      .filter((r) => r.kind === "missing")
      .reduce((s, r) => s + r.consumers, 0);
    const rowsForBars =
      hasNamed && missingTotal > 0
        ? rawRows.filter((r) => r.kind !== "missing")
        : rawRows;
    return {
      split: rankedSplit(rowsForBars, {
        missingLabel: "No store on the event",
        namedCount: breakdown?.storeCount,
      }),
      liftedUnlinked:
        metric === "sampled" && hasNamed && missingTotal > 0 ? missingTotal : 0,
    };
  }, [breakdown, metric]);
  if (!breakdown) return <Nothing title={axisCopy.title}>This chart could not load.</Nothing>;
  return (
    <div className="flex flex-col gap-2">
      <RankedSplitChart
        title={axisCopy.title}
        measure={axisCopy.measure}
        split={split}
        empty="No approved recaps in these dates."
        noun="store"
        ask={{ tenantId, startDate, endDate, chart: "consumers_by_store" }}
        where="at"
        showFoldedTailNote={metric !== "avg"}
        onBarSelect={(bar) => {
          if (bar.venue) return;
          useStoreSheetStore.getState().openStoreSheet({
            storeName: bar.label,
            fallbackTitle: bar.label,
          });
        }}
      />
      {liftedUnlinked > 0 ? (
        <p className="text-xs flex items-center gap-2 flex-wrap" style={META}>
          <span>
            +{count(liftedUnlinked)} samples from events with no linked retail store (omitted from bars so store rankings stay to scale).
          </span>
          <Link to="/recaps/list" className="underline" style={SECONDARY}>
            Review recaps →
          </Link>
        </p>
      ) : null}
      <StoreChartLinks
        tenantId={tenantId}
        labels={split.bars.filter((b) => !b.context && !b.venue).map((b) => b.label)}
      />
    </div>
  );
};

const StateInner: React.FC<Window> = ({
  tenantId,
  startDate,
  endDate,
  metric = "sampled",
}) => {
  const navigate = useNavigate();
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const axisCopy = metricAxisTitle("state", metric);
  const split = useMemo(
    () =>
      rankedSplit(transformSplitRowsByMetric(breakdown?.byState ?? [], metric), {
        missingLabel: "No state recorded",
        namedCount: breakdown?.stateCount,
      }),
    [breakdown, metric],
  );
  if (!breakdown) return <Nothing title={axisCopy.title}>This chart could not load.</Nothing>;
  return (
    <RankedSplitChart
      title={axisCopy.title}
      measure={axisCopy.measure}
      split={split}
      empty="No approved recaps in these dates."
      noun="state"
      ask={{ tenantId, startDate, endDate, chart: "consumers_by_state" }}
      where="in"
      showFoldedTailNote={metric !== "avg"}
      onBarSelect={(bar) => {
        navigate(`/account-map?state=${encodeURIComponent(bar.label)}`);
      }}
    />
  );
};

const ProductInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<TenantSkuPulseQueryType>(
    TenantSkuPulseQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const pulse = data.tenantSkuPulse;
  const split = useMemo(
    () => productSplit(pulse?.items ?? [], pulse?.totalSamples ?? 0),
    [pulse],
  );
  return (
    <RankedSplitChart
      title={PRODUCT_TITLE}
      measure="Samples handed out"
      split={split}
      empty="No recap in these dates logged samples by product."
      noun="product"
      ask={{ tenantId, startDate, endDate, chart: "samples_by_product" }}
      where="were"
    />
  );
};

export const ConsumersByStore: React.FC<Window> = (props) => (
  <Guard
    title={metricAxisTitle("store", props.metric ?? "sampled").title}
    height={splitHeight(6)}
    tenantId={props.tenantId}
    startDate={props.startDate}
    endDate={props.endDate}
  >
    <StoreInner {...props} />
  </Guard>
);

export const ConsumersByState: React.FC<Window> = (props) => (
  <Guard
    title={metricAxisTitle("state", props.metric ?? "sampled").title}
    height={splitHeight(6)}
    tenantId={props.tenantId}
    startDate={props.startDate}
    endDate={props.endDate}
  >
    <StateInner {...props} />
  </Guard>
);

export const SamplesByProduct: React.FC<Window> = (props) => (
  <Guard
    title={PRODUCT_TITLE}
    height={splitHeight(6)}
    tenantId={props.tenantId}
    startDate={props.startDate}
    endDate={props.endDate}
  >
    <ProductInner {...props} />
  </Guard>
);

const AddsUpInner: React.FC<Window> = ({
  tenantId,
  startDate,
  endDate,
  metric = "sampled",
}) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  if (!breakdown || breakdown.total <= 0) return null;
  if (metric !== "sampled") {
    return (
      <p className="text-xs" style={META}>
        Calculated across {count(breakdown.recaps)} approved{" "}
        {breakdown.recaps === 1 ? "recap" : "recaps"}, dated by the event.
      </p>
    );
  }
  return (
    <p className="text-xs" style={META}>
      The week, store and state charts each add up to the {count(breakdown.total)} consumers
      sampled at the top. All of them count approved recaps, dated by the event.
    </p>
  );
};

export const ConsumersAddUpNote: React.FC<Window> = (props) => (
  <ErrorBoundary key={`${props.tenantId}|${props.startDate}|${props.endDate}`} fallback={null}>
    <Suspense fallback={null}>
      <AddsUpInner {...props} />
    </Suspense>
  </ErrorBoundary>
);

const PER_EVENT_TITLE = "Consumers sampled per event";

const PerEventInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<ConsumersPerEventQueryType>(
    ConsumersPerEventQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const breakdown = data.tenantConsumerBreakdown;
  const each = breakdown ? perEvent(breakdown.total, breakdown.events) : null;
  if (!breakdown || each === null) return null;
  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-[13px] font-medium" style={SECONDARY}>
        {PER_EVENT_TITLE}
      </figcaption>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="m-0">
          <span className="tab-num text-2xl font-semibold" style={{ color: "var(--spark-text)" }}>
            {count(each)}
          </span>
          <span className="sr-only"> per event. </span>
        </p>
        <p className="m-0 text-sm" style={META}>
          {perEventSentence(breakdown.total, breakdown.events)}
        </p>
      </div>
    </figure>
  );
};

export const ConsumersPerEvent: React.FC<Window> = (props) => (
  <ErrorBoundary key={`${props.tenantId}|${props.startDate}|${props.endDate}`} fallback={null}>
    <Suspense fallback={null}>
      <PerEventInner {...props} />
    </Suspense>
  </ErrorBoundary>
);

export const ConsumerSplits: React.FC<Window> = (props) => (
  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
    <ConsumersByStore {...props} />
    <ConsumersByState {...props} />
    <SamplesByProduct {...props} />
  </div>
);
