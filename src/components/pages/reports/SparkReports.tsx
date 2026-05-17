import Layout from "@/layout/Layout";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useMemo } from "react";

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
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ↓ Export PDF
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
            <ChartPlaceholder
              title="Events per week · last 12 weeks"
              subtitle="Trend by activation type."
            />
          </div>
          <ChartPlaceholder
            title="Activation mix"
            subtitle="90d share by type."
          />
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
                  className="mt-3 w-full px-3 py-2 rounded-xl text-xs transition"
                  style={{
                    background: "transparent",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  Manage →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
