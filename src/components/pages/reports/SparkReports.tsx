import Layout from "@/layout/Layout";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
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
  "#c5f546", // lime
  "#5fb8ef", // sky
  "#a08bd9", // purple
  "#d6c45f", // gold
  "#ef5a2a", // orange
  "#7a8074", // muted
];

const isoWeekKey = (d: Date): string => {
  // Monday-start week label "MMM D" (week start). Cheap to compute,
  // easy to read on a 12-bar chart.
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const EventsPerWeekChart: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );
  const { labels, values } = useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 7 * 12); // 12 weeks

    // Build a list of 12 contiguous week buckets (oldest → newest)
    // so the X-axis shows zero-count weeks instead of gaps.
    const buckets: { key: string; count: number }[] = [];
    const start = new Date(cutoff);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    for (let i = 0; i < 12; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 7);
      buckets.push({ key: isoWeekKey(d), count: 0 });
    }
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
  }, [data]);

  const chartData: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Requests created",
        data: values,
        backgroundColor: "rgba(197,245,70,0.65)",
        borderColor: "rgba(197,245,70,1)",
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
  return <Bar data={chartData} options={options} />;
};

const ActivationMixChart: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );
  const { labels, values } = useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    const cutoff = Date.now() - 90 * 86_400_000;
    const counts = new Map<string, number>();
    for (const r of rows) {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
      if (!Number.isFinite(t) || t < cutoff) continue;
      const key = r.requestType?.name ?? "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(([k]) => k),
      values: sorted.map(([, v]) => v),
    };
  }, [data]);

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
      No requests in the last 90 days.
    </div>
  ) : (
    <Doughnut data={chartData} options={options} />
  );
};

/**
 * Spark v2 — Reports.
 * Wireframe: spark-demo/index.html lines 2418-2484.
 *
 * KPI strip wired to dashboard metrics; chart placeholders + scheduled
 * report tiles are visual-only until we wire chart.js + a scheduled-exports
 * backend (tracked in REBUILD-PLAN.md).
 */

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";

const SCHEDULED = [
  { name: "Monthly brand recap", category: "Brand performance", method: "PDF · Email", cadence: "daily" },
  { name: "$/Sample by market", category: "Market & RMM", method: "CSV · Sheets", cadence: "weekly" },
  { name: "Per-SKU performance", category: "Brand performance", method: "CSV", cadence: "weekly" },
  { name: "Payroll summary", category: "Financial", method: "CSV", cadence: "weekly" },
  { name: "Activation pipeline", category: "Operations", method: "PDF", cadence: "daily" },
  { name: "RMM scorecard", category: "Market & RMM", method: "PDF · Slack", cadence: "weekly" },
];

const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  tall?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, tall, children }) => (
  <div className="spark-card p-5">
    <h3
      className="display font-bold mb-2"
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
    <div style={{ position: "relative", height: tall ? 280 : 260 }}>
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
    </div>
  </div>
);

const ChartPlaceholder: React.FC<{ title: string; subtitle: string; tall?: boolean }> = ({
  title,
  subtitle,
  tall,
}) => (
  <div className="spark-card p-5">
    <h3
      className="display font-bold mb-2"
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
      style={{
        position: "relative",
        height: tall ? 280 : 260,
        background:
          "linear-gradient(180deg, rgba(197,245,70,0.04), transparent), radial-gradient(circle at 50% 100%, rgba(197,245,70,0.06), transparent 60%)",
        border: "1px dashed var(--spark-border)",
        borderRadius: 16,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div className="text-center">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          CHART
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          chart.js wiring lands next
        </p>
      </div>
    </div>
  </div>
);

export default function SparkReports() {
  const { tenantId } = useAuthStore();
  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: null,
      endDate: null,
    }),
    [],
  );
  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const m = dashboard.metrics;

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              REPORTS · LAST 90 DAYS
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              The numbers.
            </h1>
            <p
              className="mt-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Live from the analytics warehouse. Filter by brand, market,
              activation type, or BA.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Uses the same @media print stylesheet that powers the
                request-view 'Print brief'. The page strips chrome,
                inverts to dark-on-white for ink, and renders the
                KPI strip + charts. Save-as-PDF works in any browser. */}
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
              title="Save the current view as PDF via the browser print dialog"
            >
              🖨 Export PDF
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">EVENTS · 90D</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {fmtNum(m.totalEvents)}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">CONSUMERS</p>
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
              title="Requests per week · last 12 weeks"
              subtitle="Inbound activation volume."
            >
              <EventsPerWeekChart />
            </ChartCard>
          </div>
          <ChartCard
            title="Activation mix"
            subtitle="90d share by type."
          >
            <ActivationMixChart />
          </ChartCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <ChartPlaceholder
            title="Revenue per brand"
            subtitle="Last 90 days."
            tall
          />
          <ChartPlaceholder
            title="$ / sample by market"
            subtitle="Higher is better — top 8 markets."
            tall
          />
        </div>

        {/* Scheduled exports */}
        <div>
          <h3
            className="display font-bold mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            Scheduled exports
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCHEDULED.map((r) => (
              <div key={r.name} className="spark-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.16em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    {r.category.toUpperCase()}
                  </span>
                  <span
                    className={`chip ${r.cadence === "daily" ? "chip-lime" : "chip-sky"}`}
                  >
                    ● {r.cadence.toUpperCase()}
                  </span>
                </div>
                <p className="font-bold text-sm">{r.name}</p>
                <p
                  className="mono text-[10px] mt-2"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  {r.method.toUpperCase()}
                </p>
                <button
                  disabled
                  title="Scheduled-exports backend ships in the next sprint"
                  className="mt-3 w-full px-3 py-2 rounded-xl text-xs transition"
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid var(--spark-border)",
                    cursor: "not-allowed",
                  }}
                >
                  Manage → (soon)
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
