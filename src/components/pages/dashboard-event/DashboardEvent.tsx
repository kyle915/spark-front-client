import { useMemo, useState } from "react";
import { format } from "date-fns";
import Layout from "@/layout/Layout";
import { MetricCard } from "@/components/cards/metric-card";
import FiltersPanel, {
  type FiltersState,
} from "@/components/filters/FiltersPanel";
import ChartCard from "@/components/charts/ChartCard";

import { CalendarDays } from "lucide-react";

import DashboardHeader from "../dashboard/DashboardHeader";

import MonthlyTrendsChart from "../dashboard-event/MonthlyTrendsSection";
// import DemographicInsightSection from "../dashboard-event/DemographicInsightSection";
import PerformanceInsights from "../dashboard-event/PerformanceInsights";
import GoalsProgressSection from "../dashboard-event/GoalsProgressSection";
import RegionalMarketPerformance from "../dashboard-event/RegionalMarketPerformance";
import RecentEventsCarousel from "../dashboard-event/RecentEventsCarousel";

import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { AiInsightsSection } from "@/components/ai-insights/AiInsightsSection";

import { aiInsightsMock } from "@/data/dashboard-events/aiInsightsMock";
import { regionalMarketMock } from "@/data/dashboard-events/regionalMarketMock";
import { useAuthStore } from "@/store/authStore";
import { useLazyLoadQuery } from "react-relay";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

const defaultFilters: FiltersState = {
  distributor: "",
  rmm: "",
  quarter: "",
  dateRange: undefined,
};

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

export default function DashboardIndex() {
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [fetchKey, setFetchKey] = useState(0);
  const { tenantId } = useAuthStore();

  const filtersInput = useMemo(() => {
    const startDate = filters.dateRange?.from
      ? format(filters.dateRange.from, "yyyy-MM-dd")
      : null;
    const endDate = filters.dateRange?.to
      ? format(filters.dateRange.to, "yyyy-MM-dd")
      : null;

    const input = {
      distributorId: filters.distributor || null,
      rmmAsignedId: filters.rmm || null,
      quarter: filters.quarter || null,
      startDate,
      endDate,
    };

    return input;
  }, [filters]);

  const { dashboard, filterOptions } = useEventDashboardData(
    tenantId || "",
    filtersInput,
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
      key: "consumersSampled",
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
      change: "0%", // no hay comparación en el query
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

  const distributors =
    filterOptions?.distributors?.map((d) => ({
      value: d.id,
      label: d.name,
    })) ?? [];

  const rrmOptions = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId: tenantId || "" },
    { fetchPolicy: "store-and-network" },
  );

  const rmmOptionsMap = rrmOptions.rmmClients.map((rmm) => ({
    value: rmm.id,
    label: rmm.firstName ? `${rmm.firstName} ${rmm.lastName}` : rmm.username,
  }));

  const quarterOptions =
    filterOptions?.quarters?.map((q) => ({
      value: q.value,
      label: q.label,
    })) ?? [];

  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5 space-y-10">
        {/* HEADER */}
        <DashboardHeader title="Event Recap Dashboard" />

        {/* FILTERS */}
        <div className="relative z-40">
          <FiltersPanel
            distributors={distributors}
            rmmOptions={rmmOptionsMap}
            quarterOptions={quarterOptions}
            onApplyFilters={(nextFilters) => {
              setFilters(nextFilters);
              setFetchKey((key) => key + 1);
            }}
          />
        </div>

        {/* METRICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            fixedHeight={true}
          >
            <MonthlyTrendsChart data={monthlyTrends} />
          </ChartCard>
        </section>

        {/* DEMOGRAPHIC INSIGHTS */}
        {/* <section className="w-full ">
          <DemographicInsightSection
            ageDistribution={[
              { label: "18-24", value: 22, consumers: 2745 },
              { label: "25-34", value: 35, consumers: 4368 },
              { label: "35-44", value: 28, consumers: 3494 },
              { label: "45-54", value: 12, consumers: 1497 },
              { label: "55+", value: 3, consumers: 374 },
            ]}
            genderDistribution={[
              { label: "Male", value: 58 },
              { label: "Female", value: 42 },
            ]}
          />
        </section> */}

        {/* PERFORMANCE INSIGHTS */}
        <section className="w-full">
          <PerformanceInsights data={dashboard.performanceInsights} />
        </section>

        <section className="w-full grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <GoalsProgressSection
              goals={[
                { label: "Events Target", current: 0, target: 200 },
                { label: "Consumer Sampling", current: 0, target: 25000 },
                { label: "Brand Awareness", current: 0, target: 50 },
                { label: "Purchase Intent", current: 0, target: 75 },
                { label: "Female Participation", current: 0, target: 65 },
                { label: "First-Time Buyers", current: 0, target: 70 },
                { label: "First-Time Buyers-2", current: 0, target: 70 },
                { label: "First-Time Buyers-3", current: 0, target: 70 },
                { label: "First-Time Buyers-4", current: 0, target: 70 },
              ]}
            />
          </div>

          <div className="col-span-2">
            <RegionalMarketPerformance data={regionalMarketMock} />
          </div>
        </section>

        <section className="w-full">
          <RecentEventsCarousel events={recentEvents} />
        </section>

        {/* AI INSIGHTS */}
        <AiInsightsSection insights={aiInsightsMock} isLoading={false} />
      </main>
    </Layout>
  );
}
