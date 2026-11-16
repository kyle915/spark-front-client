import { Suspense, useMemo, type ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Bar, Line } from "react-chartjs-2";
import "@/lib/sparkChartRegister";
import ChartBlock from "@/components/charts/ChartBlock";
import AskAboutChart from "@/components/explain/AskAboutChart";
import ErrorBoundary from "@/components/ErrorBoundary";
import { StoreChartLinks } from "@/components/store/StoreLinks";
import { useConsumerBreakdown } from "@/hooks/useConsumerBreakdown";
import { ConsumersPerEventQuery } from "@/api/queries/ConsumersPerEventQuery";
import type { ConsumersPerEventQuery as ConsumersPerEventQueryType } from "@api/queries/__generated__/ConsumersPerEventQuery.graphql";
import { TenantSkuPulseQuery } from "@/api/queries/TenantSkuPulseQuery";
import type { TenantSkuPulseQuery as TenantSkuPulseQueryType } from "@api/queries/__generated__/TenantSkuPulseQuery.graphql";
import { labelsEveryRow } from "@/lib/chartRows";
import {
  contextIndexes,
  lastWeeksWindow,
  perEvent,
  perEventSentence,
  productSplit,
  rankedSplit,
  shortLabel,
  weeklyTrend,
  type RankedSplit,
} from "@/lib/consumerBreakdown";
import type { ChartKind } from "@/lib/dashboardExplain";
import { barSeries, chartOptions, lineSeries, valueLabels } from "@/lib/sparkChart";

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

type Window = { tenantId: string; startDate: string; endDate: string };

/** Keeps one chart's failed or slow query from taking the page with it. */
const Guard: React.FC<Window & { title: string; height: number; children: ReactNode }> = ({
  title,
  height,
  children,
  tenantId,
  startDate,
  endDate,
}) => (
  // Keyed on the window so a failed load does not stick after the dates change.
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

const WEEKLY_TITLE = "Consumers sampled per week";
const WEEKLY_HEIGHT = 200;

const WeeklyInner: React.FC<Window & { note?: string }> = ({
  tenantId,
  startDate,
  endDate,
  note,
}) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const trend = useMemo(() => weeklyTrend(breakdown?.byWeek ?? []), [breakdown]);
  if (!breakdown) {
    return <Nothing title={WEEKLY_TITLE}>This chart could not load.</Nothing>;
  }
  if (!trend.hasData) {
    return <Nothing title={WEEKLY_TITLE}>No approved recaps in these weeks yet.</Nothing>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ChartBlock title={WEEKLY_TITLE} height={WEEKLY_HEIGHT}>
        <Line
          data={{
            labels: trend.labels,
            datasets: [lineSeries({ label: "Consumers sampled", data: trend.values })],
          }}
          options={chartOptions<"line">()}
          plugins={[lastValue]}
        />
      </ChartBlock>
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
        title={WEEKLY_TITLE}
      />
    </div>
  );
};

/** The weekly trend for a window the caller picks (the report's dates). */
export const ConsumersPerWeek: React.FC<Window & { note?: string }> = (props) => (
  <Guard title={WEEKLY_TITLE} height={WEEKLY_HEIGHT} tenantId={props.tenantId} startDate={props.startDate} endDate={props.endDate}>
    <WeeklyInner {...props} />
  </Guard>
);

const TREND_WEEKS = 12;

/**
 * The weekly trend on a dashboard: always the last twelve finished weeks,
 * whatever range the rest of the page is showing, because a 7- or 30-day
 * window is one to five points and not a trend. The week in progress is
 * left out, so the line does not end on a part week.
 */
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
  /** What a bar measures, for the tooltip. */
  measure: string;
  split: RankedSplit;
  /** Said when nothing was recorded at all. */
  empty: string;
  /** "store" / "state" / "product": the noun for the folded tail. */
  noun: string;
  /** Joins the sentence when one row is the whole split: "at" Costco, "in" CA. */
  where: string;
  /** Which chart this is, so a question about it can be asked. */
  ask: Window & { chart: ChartKind };
}> = ({ title, measure, split, empty, noun, where, ask }) => {
  const { bars, aside } = split;
  if (bars.length === 0) return <Nothing title={title}>{empty}</Nothing>;
  // One row is a sentence, not a one-bar chart.
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
  return (
    <div className="flex flex-col gap-2">
      <ChartBlock title={title} height={splitHeight(bars.length)}>
        <Bar
          data={{
            labels: bars.map((b) => shortLabel(b.label)),
            datasets: [
              barSeries({
                label: measure,
                data: bars.map((b) => b.value),
                quiet: contextIndexes(bars),
                horizontal: true,
              }),
            ],
          }}
          options={chartOptions<"bar">({ horizontal: true })}
          plugins={labelsEveryRow(bars.length) ? [everyValue] : []}
        />
      </ChartBlock>
      {aside ? (
        <p className="text-xs" style={META}>
          {aside.count
            ? `The other ${count(aside.count)} ${noun}${aside.count === 1 ? "" : "s"} add ${count(aside.value)}.`
            : `Other ${noun}s add ${count(aside.value)}.`}
        </p>
      ) : null}
      <AskAboutChart {...ask} title={title} />
    </div>
  );
};

const STORE_TITLE = "Consumers sampled by store";
const STATE_TITLE = "Consumers sampled by state";
const PRODUCT_TITLE = "Samples handed out by product";

const StoreInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const split = useMemo(
    () =>
      rankedSplit(breakdown?.byStore ?? [], {
        missingLabel: "No store recorded",
        namedCount: breakdown?.storeCount,
      }),
    [breakdown],
  );
  if (!breakdown) return <Nothing title={STORE_TITLE}>This chart could not load.</Nothing>;
  return (
    <div className="flex flex-col gap-2">
      <RankedSplitChart
        title={STORE_TITLE}
        measure="Consumers sampled"
        split={split}
        empty="No approved recaps in these dates."
        noun="store"
        ask={{ tenantId, startDate, endDate, chart: "consumers_by_store" }}
        where="at"
      />
      <StoreChartLinks
        tenantId={tenantId}
        labels={split.bars.filter((b) => !b.context).map((b) => b.label)}
      />
    </div>
  );
};

const StateInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const split = useMemo(
    () =>
      rankedSplit(breakdown?.byState ?? [], {
        missingLabel: "No state recorded",
        namedCount: breakdown?.stateCount,
      }),
    [breakdown],
  );
  if (!breakdown) return <Nothing title={STATE_TITLE}>This chart could not load.</Nothing>;
  return (
    <RankedSplitChart
      title={STATE_TITLE}
      measure="Consumers sampled"
      split={split}
      empty="No approved recaps in these dates."
      noun="state"
      ask={{ tenantId, startDate, endDate, chart: "consumers_by_state" }}
      where="in"
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
  <Guard title={STORE_TITLE} height={splitHeight(6)} tenantId={props.tenantId} startDate={props.startDate} endDate={props.endDate}>
    <StoreInner {...props} />
  </Guard>
);

export const ConsumersByState: React.FC<Window> = (props) => (
  <Guard title={STATE_TITLE} height={splitHeight(6)} tenantId={props.tenantId} startDate={props.startDate} endDate={props.endDate}>
    <StateInner {...props} />
  </Guard>
);

export const SamplesByProduct: React.FC<Window> = (props) => (
  <Guard title={PRODUCT_TITLE} height={splitHeight(6)} tenantId={props.tenantId} startDate={props.startDate} endDate={props.endDate}>
    <ProductInner {...props} />
  </Guard>
);

const AddsUpInner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  if (!breakdown || breakdown.total <= 0) return null;
  return (
    <p className="text-xs" style={META}>
      The week, store and state charts each add up to the {count(breakdown.total)} consumers
      sampled at the top. All of them count approved recaps, dated by the event.
    </p>
  );
};

/** Says the charts reconcile with the headline, only once they have loaded. */
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
      {/* Two elements with real text between them, so a screen reader and
          a copy read "83 per event. 498 consumers across 6 events…" and
          never "83498 consumers". */}
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

/**
 * One plain figure: consumers sampled divided by the events they were
 * sampled at. Shows nothing when there is nothing to divide or the load
 * fails, so it never prints a zero or a broken number.
 */
export const ConsumersPerEvent: React.FC<Window> = (props) => (
  <ErrorBoundary key={`${props.tenantId}|${props.startDate}|${props.endDate}`} fallback={null}>
    <Suspense fallback={null}>
      <PerEventInner {...props} />
    </Suspense>
  </ErrorBoundary>
);

/**
 * Store, state and product side by side. Store and state split the same
 * consumers-sampled total; product counts samples handed out, which is a
 * different measure and says so in its title.
 */
export const ConsumerSplits: React.FC<Window> = (props) => (
  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
    <ConsumersByStore {...props} />
    <ConsumersByState {...props} />
    <SamplesByProduct {...props} />
  </div>
);
