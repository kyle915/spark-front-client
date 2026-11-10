import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkGhostButton from "@/shared/SparkGhostButton";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { Suspense, createContext, useContext, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { ReportsRequestsChartQuery } from "@/api/queries/ReportsRequestsChartQuery";
import type { ReportsRequestsChartQuery as ReportsRequestsChartQueryType } from "@api/queries/__generated__/ReportsRequestsChartQuery.graphql";
import { ReportsEngagementsChartQuery } from "@/api/queries/ReportsEngagementsChartQuery";
import type { ReportsEngagementsChartQuery as ReportsEngagementsChartQueryType } from "@api/queries/__generated__/ReportsEngagementsChartQuery.graphql";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

const SPARK_PALETTE = [
  "#f2f3ee", // lime
  "#5fb8ef", // sky
  "#a08bd9", // purple
  "#d6c45f", // gold
  "#ef5a2a", // orange
  "#7a8074", // muted
];

/** Cap matches Account Map / list ceiling — enough for 90d tenant charts. */
const CHART_PAGE_SIZE = 2000;

const isoWeekKey = (d: Date): string => {
  // Monday-start week label "MMM D" (week start). Cheap to compute,
  // easy to read on a 12-bar chart.
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

type EngagementRow = {
  createdAt: string | null | undefined;
  eventDate: string | null | undefined;
  eventRetailer: string | null | undefined;
  consumers: number;
};

const engagementFromClassic = (n: {
  totalEngagements: number | null | undefined;
  consumerEngagements: ReadonlyArray<{
    totalConsumer: number | null | undefined;
  } | null> | null;
}): number => {
  const fromCe = (n.consumerEngagements ?? []).reduce((sum, row) => {
    const v = row?.totalConsumer;
    return sum + (typeof v === "number" ? v : 0);
  }, 0);
  if (fromCe > 0) return fromCe;
  return typeof n.totalEngagements === "number" ? n.totalEngagements : 0;
};

const engagementFromCustom = (n: {
  consumersSampled: number | null | undefined;
  totalEngagements: number | null | undefined;
}): number => {
  // Prefer consumers sampled only — do not conflate with totalEngagements / reach.
  if (typeof n.consumersSampled === "number") return n.consumersSampled;
  void n.totalEngagements;
  return 0;
};

// ---------------------------------------------------------------------------
// Date range — one window for the KPI strip and every chart on the page.
// ---------------------------------------------------------------------------
type RangeKey = "30" | "90" | "180" | "ytd" | "custom";
type ReportsRange = { start: Date; end: Date; label: string };

const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseYmd = (v: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const out = new Date(y, m - 1, d);
  return Number.isNaN(out.getTime()) ? null : out;
};

function buildReportsRange(
  key: RangeKey,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): ReportsRange {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const startOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  if (key === "custom") {
    const from = parseYmd(customFrom);
    const to = parseYmd(customTo);
    if (from && to && from <= to) {
      const e = new Date(to);
      e.setHours(23, 59, 59, 999);
      return { start: startOf(from), end: e, label: `${customFrom} → ${customTo}` };
    }
    key = "90";
  }
  if (key === "ytd") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end,
      label: "Year to date",
    };
  }
  const days = Number(key);
  const start = startOf(now);
  start.setDate(start.getDate() - days);
  return { start, end, label: `Last ${days} days` };
}

/** Contiguous Monday-start week buckets covering the range (4–53 weeks). */
const weekBuckets = (range: ReportsRange) => {
  const start = new Date(range.start);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  const weeks = Math.min(
    53,
    Math.max(4, Math.ceil((range.end.getTime() - start.getTime()) / (7 * 86_400_000))),
  );
  const buckets: { key: string; count: number }[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    buckets.push({ key: isoWeekKey(d), count: 0 });
  }
  return buckets;
};

const ReportsRangeContext = createContext<ReportsRange>(
  buildReportsRange("90", "", ""),
);
const useReportsRange = () => useContext(ReportsRangeContext);

const useReportsRequestRows = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<ReportsRequestsChartQueryType>(
    ReportsRequestsChartQuery,
    { first: CHART_PAGE_SIZE, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );
  return useMemo(
    () =>
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [data],
  );
};

const useReportsEngagementRows = (): EngagementRow[] => {
  const { tenantId } = useAuthStore();
  const filters = tenantId ? { tenantId } : null;
  const data = useLazyLoadQuery<ReportsEngagementsChartQueryType>(
    ReportsEngagementsChartQuery,
    {
      first: CHART_PAGE_SIZE,
      filters,
      customFilters: filters,
    },
    { fetchPolicy: "store-or-network" },
  );
  return useMemo(() => {
    const classic =
      data?.recaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => ({
          createdAt: n.createdAt,
          eventDate: n.eventDate,
          eventRetailer: n.eventRetailer,
          consumers: engagementFromClassic(n),
        })) ?? [];
    const custom =
      data?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => ({
          createdAt: n.createdAt,
          eventDate: n.eventDate,
          eventRetailer: n.eventRetailer,
          consumers: engagementFromCustom(n),
        })) ?? [];
    return [...classic, ...custom];
  }, [data]);
};

const EventsPerWeekChart: React.FC = () => {
  const rows = useReportsRequestRows();
  const range = useReportsRange();
  const { labels, values } = useMemo(() => {
    const cutoff = range.start;
    const today = range.end;
    // Contiguous week buckets (oldest → newest) so the X-axis shows
    // zero-count weeks instead of gaps.
    const buckets = weekBuckets(range);
    const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));

    for (const r of rows) {
      const raw = r.createdAt;
      if (!raw) continue;
      const d = new Date(raw);
      if (d < cutoff || d > today) continue;
      const key = isoWeekKey(d);
      const idx = idxByKey.get(key);
      if (idx !== undefined) buckets[idx].count += 1;
    }
    return {
      labels: buckets.map((b) => b.key),
      values: buckets.map((b) => b.count),
    };
  }, [rows, range]);

  const chartData: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Requests created",
        data: values,
        backgroundColor: "rgba(242,243,238,0.65)",
        borderColor: "rgba(242,243,238,1)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} created`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "rgba(255,255,255,0.55)", maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "rgba(255,255,255,0.55)", precision: 0 },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
    },
  };
  if (values.every((v) => v === 0)) {
    return (
      <div
        className="grid place-items-center h-full text-xs"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        No requests created in this window.
      </div>
    );
  }
  return <Bar data={chartData} options={options} />;
};

const ActivationMixChart: React.FC = () => {
  const rows = useReportsRequestRows();
  const range = useReportsRange();
  const { labels, values } = useMemo(() => {
    const cutoff = range.start.getTime();
    const until = range.end.getTime();
    const counts = new Map<string, number>();
    for (const r of rows) {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
      if (!Number.isFinite(t) || t < cutoff || t > until) continue;
      const key = r.requestType?.name ?? "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(([k]) => k),
      values: sorted.map(([, v]) => v),
    };
  }, [rows, range]);

  const chartData: ChartData<"doughnut"> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map(
          (_, i) => SPARK_PALETTE[i % SPARK_PALETTE.length],
        ),
        borderColor: "#0a0d09",
        borderWidth: 2,
      },
    ],
  };
  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "rgba(255,255,255,0.75)",
          font: { size: 12 },
          padding: 12,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
        },
      },
    },
    cutout: "62%",
  };
  return values.length === 0 ? (
    <div
      className="grid place-items-center h-full text-xs"
      style={{ color: "rgba(255,255,255,0.45)" }}
    >
      No requests in this date range.
    </div>
  ) : (
    <Doughnut data={chartData} options={options} />
  );
};

// ---------------------------------------------------------------------------
// Recap-driven charts (classic + custom; prefer consumersSampled on custom).
// ---------------------------------------------------------------------------

const ConsumersSampledChart: React.FC = () => {
  const rows = useReportsEngagementRows();
  const range = useReportsRange();
  const { labels, values } = useMemo(() => {
    const cutoff = range.start;
    const today = range.end;
    const buckets = weekBuckets(range);
    const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));

    for (const r of rows) {
      const raw = r.eventDate ?? r.createdAt;
      if (!raw) continue;
      const d = new Date(raw);
      if (d < cutoff || d > today) continue;
      const idx = idxByKey.get(isoWeekKey(d));
      if (idx === undefined) continue;
      buckets[idx].count += r.consumers;
    }
    return {
      labels: buckets.map((b) => b.key),
      values: buckets.map((b) => b.count),
    };
  }, [rows, range]);

  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) {
    return (
      <div
        className="grid place-items-center h-full text-xs"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        No consumer engagements recorded yet.
      </div>
    );
  }

  const chartData: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Consumers sampled",
        data: values,
        backgroundColor: "rgba(95,184,239,0.55)",
        borderColor: "rgba(95,184,239,1)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${(ctx.parsed.y ?? 0).toLocaleString()} consumers`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "rgba(255,255,255,0.55)", maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "rgba(255,255,255,0.55)", precision: 0 },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
    },
  };
  if (values.every((v) => v === 0)) {
    return (
      <div
        className="grid place-items-center h-full text-xs"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        No consumers sampled in this window.
      </div>
    );
  }
  return <Bar data={chartData} options={options} />;
};

const TopRetailersChart: React.FC = () => {
  const rows = useReportsEngagementRows();
  const range = useReportsRange();
  const { labels, values } = useMemo(() => {
    const cutoff = range.start.getTime();
    const until = range.end.getTime();
    const totals = new Map<string, number>();
    for (const r of rows) {
      const raw = r.eventDate ?? r.createdAt;
      const t = raw ? new Date(raw).getTime() : NaN;
      if (!Number.isFinite(t) || t < cutoff || t > until) continue;
      if (r.consumers <= 0) continue;
      const name = r.eventRetailer || "Unknown";
      totals.set(name, (totals.get(name) ?? 0) + r.consumers);
    }
    const sorted = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return {
      labels: sorted.map(([k]) => k),
      values: sorted.map(([, v]) => v),
    };
  }, [rows, range]);

  if (values.length === 0 || values.every((v) => v === 0)) {
    return (
      <div
        className="grid place-items-center h-full text-xs"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        No retailer activity in this date range.
      </div>
    );
  }

  const chartData: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Consumers sampled",
        data: values,
        backgroundColor: "rgba(242,243,238,0.55)",
        borderColor: "rgba(242,243,238,1)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${(ctx.parsed.x ?? 0).toLocaleString()} consumers`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: "rgba(255,255,255,0.55)", precision: 0 },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      y: {
        ticks: { color: "rgba(255,255,255,0.75)" },
        grid: { display: false },
      },
    },
  };
  if (values.length === 0 || values.every((v) => v === 0)) {
    return (
      <div
        className="grid place-items-center h-full text-xs"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        No retailer sampling volume yet.
      </div>
    );
  }
  return <Bar data={chartData} options={options} />;
};

/**
 * Spark v2 — Reports.
 * Wireframe: spark-demo/index.html lines 2418-2484.
 *
 * KPI strip wired to dashboard metrics. Four charts wired to live data
 * (slim ReportsRequestsChartQuery + ReportsEngagementsChartQuery).
 * One date range (presets or custom) drives the KPI strip and every chart.
 */

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";


const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  tall?: boolean;
  empty?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, tall, empty, children }) => (
  <div className="spark-card p-5">
    <h3
      className="spark-title font-semibold mb-2"
      style={{ letterSpacing: "-0.02em" }}
    >
      {title}
    </h3>
    <p
      className="text-xs mb-3"
      style={{ color: "rgba(255,255,255,0.55)" }}
    >
      {subtitle}
    </p>
    <div
      className={
        tall
          ? "relative h-[200px] sm:h-[260px] md:h-[300px]"
          : "relative h-[180px] sm:h-[240px] md:h-[260px]"
      }
    >
      {empty ? (
        <div className="spark-chart-empty h-full text-xs">
          No data for this range yet.
        </div>
      ) : (
        <Suspense
          fallback={
            <div
              className="grid place-items-center h-full text-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Loading…
            </div>
          }
        >
          {children}
        </Suspense>
      )}
    </div>
  </div>
);

export default function SparkReports() {
  const { tenantId } = useAuthStore();
  const [rangeKey, setRangeKey] = useState<RangeKey>("90");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(
    () => buildReportsRange(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );
  const customIncomplete =
    rangeKey === "custom" && range.label.startsWith("Last ");
  const startYmd = ymdLocal(range.start);
  const endYmd = ymdLocal(range.end);
  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: startYmd,
      endDate: endYmd,
    }),
    [startYmd, endYmd],
  );
  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const m = dashboard.metrics;

  return (
    <Layout>
      <ReportsRangeContext.Provider value={range}>
      <div className="space-y-6 max-w-7xl spark-fade-in">
        <SparkPageHeader
          eyebrow={`REPORTS · ${range.label.toUpperCase()}`}
          title="The numbers."
          support="Live from the analytics warehouse. Consumers counted are sampled — not reach or samples handed out."
          action={
            <SparkGhostButton
              onClick={() => window.print()}
              title="Save the current view as PDF via the browser print dialog"
            >
              Export PDF
            </SparkGhostButton>
          }
        />

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {(
            [
              ["30", "30 days"],
              ["90", "90 days"],
              ["180", "6 months"],
              ["ytd", "Year to date"],
              ["custom", "Custom"],
            ] as [RangeKey, string][]
          ).map(([key, label]) => {
            const on = rangeKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRangeKey(key)}
                aria-pressed={on}
                className="text-sm rounded-xl px-3 py-1.5 font-semibold"
                style={{
                  color: on ? "#0a0d09" : "var(--spark-text)",
                  background: on ? "var(--spark-lime)" : "transparent",
                  border: `1px solid ${on ? "var(--spark-lime)" : "var(--spark-border)"}`,
                }}
              >
                {label}
              </button>
            );
          })}
          {rangeKey === "custom" && (
            <span className="inline-flex items-center gap-2 text-sm">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Range start"
                className="rounded-lg px-2 py-1"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  colorScheme: "dark",
                }}
              />
              <span style={{ color: "rgba(255,255,255,0.5)" }}>to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Range end"
                className="rounded-lg px-2 py-1"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  colorScheme: "dark",
                }}
              />
              {customIncomplete && (
                <span style={{ color: "rgba(255,255,255,0.55)" }}>
                  Pick both dates — showing the last 90 days until then.
                </span>
              )}
            </span>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">EVENTS</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {fmtNum(m.totalEvents)}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">CONSUMERS SAMPLED</p>
            <p className="tab-num text-3xl font-bold mt-1">
              {fmtNum(m.consumersSampled)}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">BRAND AWARENESS</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {typeof m.brandAwareness === "number"
                ? `${m.brandAwareness.toFixed(1)}%`
                : "—"}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">PURCHASE INTENT</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {typeof m.purchaseIntent === "number"
                ? `${m.purchaseIntent.toFixed(1)}%`
                : "—"}
            </p>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ChartCard
              title="Requests per week"
              subtitle="Inbound activation volume."
            >
              <EventsPerWeekChart />
            </ChartCard>
          </div>
          <ChartCard
            title="Activation mix"
            subtitle="Share by type in this range."
          >
            <ActivationMixChart />
          </ChartCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <ChartCard
            title="Consumers sampled per week"
            subtitle="Sum of recap engagements per week."
            tall
          >
            <ConsumersSampledChart />
          </ChartCard>
          <ChartCard
            title="Top retailers"
            subtitle="Consumers sampled — top 8 retailers."
            tall
          >
            <TopRetailersChart />
          </ChartCard>
        </div>
      </div>
      </ReportsRangeContext.Provider>
    </Layout>
  );
}
