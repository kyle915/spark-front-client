import { useState } from "react";
import Layout from "@/layout/Layout";
import { MetricCard } from "@/components/cards/metric-card";
import FiltersPanel, {
  type DashboardFilters,
} from "@/components/filters/FiltersPanel";
import ChartCard from "@/components/charts/ChartCard";
import { CalendarDays } from "lucide-react";

import DashboardHeader from "../dashboard/DashboardHeader";
import MonthlyTrendsChart from "../dashboard-event/MonthlyTrendsSection";
import PerformanceInsights from "../dashboard-event/PerformanceInsights";
import GoalsProgressSection from "../dashboard-event/GoalsProgressSection";
import RecentEventsCarousel from "../dashboard-event/RecentEventsCarousel";

import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { AiInsightsSection } from "@/components/ai-insights/AiInsightsSection";

import { useAuthStore } from "@/store/authStore";

/* =========================
   Helpers
========================= */
const formatNumber = (value?: number | null) =>
  typeof value === "number" ? value.toLocaleString() : "0";

const formatPercent = (value?: number | null) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "0%";

const formatDelta = (current?: number | null, previous?: number | null) => {
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    previous === 0
  )
    return "0%";

  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
};

type DashboardGoalProgress = {
  name?: string | null;
  target?: number | null;
  current?: number | null;
};

/* =========================
   Dashboard
========================= */
export default function DashboardIndex() {
  const { tenantId } = useAuthStore();

  const [filters, setFilters] = useState<DashboardFilters>({
    distributorIds: [],
    rmmAsignedId: null,
    quarter: null,
    startDate: null,
    endDate: null,
  });

  const [fetchKey, setFetchKey] = useState(0);
  const { dashboard } = useEventDashboardData(
    tenantId || "",
    filters,
    fetchKey,
  );

  const { metrics, globalKpis } = dashboard;

  const comparisonLabel = metrics.comparisonPeriod
    ? `vs ${metrics.comparisonPeriod}`
    : "vs previous period";

  const metricItems = [
    {
      key: "totalEvents",
      title: "Total Events",
      value: formatNumber(metrics.totalEvents),
      change: formatDelta(
        metrics.totalEvents,
        metrics.comparisonValues?.totalEvents,
      ),
    },
    {
      key: "totalConsumersSampled",
      title: "Consumers Sampled",
      value: formatNumber(metrics.consumersSampled),
      change: formatDelta(
        metrics.consumersSampled,
        metrics.comparisonValues?.consumersSampled,
      ),
    },
    {
      key: "brandAwareness",
      title: "Brand Awareness",
      value: formatPercent(metrics.brandAwareness),
      change: formatDelta(
        metrics.brandAwareness,
        metrics.comparisonValues?.brandAwareness,
      ),
    },
    {
      key: "purchaseIntent",
      title: "Purchase Intent",
      value: formatPercent(metrics.purchaseIntent),
      change: formatDelta(
        metrics.purchaseIntent,
        metrics.comparisonValues?.purchaseIntent,
      ),
    },
    {
      key: "multiPacksSold",
      title: "Multi Packs Sold",
      value: formatNumber(globalKpis?.multiPacksSold),
      change: "0%",
    },
    {
      key: "singleCansSold",
      title: "Single Cans Sold",
      value: formatNumber(globalKpis?.singleCansSold),
      change: "0%",
    },
  ];

  const monthlyTrends = dashboard.monthlyTrends.dataPoints.map((point) => ({
    month: point.month,
    consumers: point.consumersSampled,
    purchases: point.eventsCount,
    conversion: point.conversionRate,
  }));

  const recentEvents = (dashboard.recentEvents ?? []).map((event) => ({
    title: event.name,
    date: event.date,
    rmm: event.location,
    consumers: event.consumers,
    intent: event.intentRate,
    status: event.status,
  }));

  const goalsProgress = (
    (dashboard as { goalsProgress?: DashboardGoalProgress[] }).goalsProgress ??
    []
  ).map((goal) => ({
    label: goal.name ?? "Goal",
    current: goal.current ?? 0,
    target: goal.target ?? 0,
  }));

  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5 space-y-10">
        {/* HEADER */}
        <DashboardHeader title="Event Recap Dashboard" />

        {/* FILTERS */}
        <div className="relative z-40">
          <FiltersPanel
            onApplyFilters={(nextFilters) => {
              setFilters(nextFilters);
              setFetchKey((k) => k + 1);
            }}
          />
        </div>

        {/* METRICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3  gap-6">
          {metricItems.map((metric) => (
            <MetricCard
              key={metric.key}
              metricKey={metric.key}
              title={metric.title}
              value={metric.value}
              change={metric.change}
              variant={metric.change.startsWith("-") ? "error" : "success"}
              comparisonLabel={comparisonLabel}
            />
          ))}
        </section>

        {/* MONTHLY PERFORMANCE */}
        <section className="w-full">
          <ChartCard
            title="Monthly Performance Trends"
            icon={CalendarDays}
            iconColor="text-blue-600"
            fixedHeight
          >
            <MonthlyTrendsChart data={monthlyTrends} />
          </ChartCard>
        </section>

        {/* PERFORMANCE INSIGHTS */}
        <section className="w-full">
          <PerformanceInsights data={dashboard.performanceInsights} />
        </section>

        <section className="w-full">
          <div>
            {filters.rmmAsignedId ? (
              <GoalsProgressSection goals={goalsProgress} />
            ) : (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body">
                  <h3 className="card-title text-base">Goals</h3>
                  <p className="text-sm text-base-content/70">
                    Select an RMM first to view goals.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="w-full">
          <RecentEventsCarousel events={recentEvents} />
        </section>

        {/* AI INSIGHTS */}
        <AiInsightsSection insights={[]} isLoading={false} />
      </main>
    </Layout>
  );
}
