import { useState } from "react";
import Layout from "@/layout/Layout";
import { CalendarDays, UsersRound } from "lucide-react";
import FiltersPanel, {
  type DashboardFilters,
} from "@/components/filters/FiltersPanel";
import ChartCard from "@/components/charts/ChartCard";
import { MetricCard } from "@/components/cards/metric-card";
import { AiInsightsSection } from "@/components/ai-insights/AiInsightsSection";

import DashboardHeader from "../dashboard/DashboardHeader";
import MonthlyTrendsSection from "../dashboard-retail/MonthlyTrendsSection";

import QuarterSummaryCards from "./QuarterSummaryCards";
import MarketPerformanceTable from "./MarketPerformanceTable";
import VerticalPerformanceInsights from "./VerticalPerformanceInsights";
import RmmPerformanceChart from "./RmmPerformanceChart";
import RetailAccountsPerformance from "./RetailAccountsPerformance";
import ReachConversionChart from "./ReachConversionChart";

import { useRecapDashboardData } from "@/hooks/useRecapDashboardData";
import { aiInsightsMockV2 } from "@/data/dashboard-retail/aiInsightsMock";
import { useAuthStore } from "@/store/authStore";

/* =========================
   Helpers
========================= */

const formatNumber = (value: number) => value.toLocaleString();
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatDelta = (current: number, previous?: number | null) => {
  if (!previous || previous === 0) return "0%";
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
};

export default function DashboardRetail() {
  const { tenantId } = useAuthStore();

  const [filters, setFilters] = useState<DashboardFilters>({
    distributorId: null,
    rmmAsignedId: null,
    quarter: null,
    startDate: null,
    endDate: null,
  });

  const [fetchKey, setFetchKey] = useState(0);

  const { dashboard } = useRecapDashboardData(
    tenantId || "",
    filters,
    fetchKey,
  );

  const metrics = dashboard.metrics;
  const comparison = metrics.comparisonValues;
  const comparisonLabel = metrics.comparisonPeriod
    ? `vs ${metrics.comparisonPeriod}`
    : "vs previous period";

  const metricItems = [
    {
      key: "totalConsumersSampled",
      title: "Total Consumers Sampled",
      value: formatNumber(metrics.totalConsumersSampled),
      change: formatDelta(
        metrics.totalConsumersSampled,
        comparison?.totalConsumersSampled,
      ),
    },
    {
      key: "totalPurchases",
      title: "Total Purchases",
      value: formatNumber(metrics.totalPurchases),
      change: formatDelta(metrics.totalPurchases, comparison?.totalPurchases),
    },
    {
      key: "overallConversionRate",
      title: "Overall Conversion Rate",
      value: formatPercent(metrics.conversionRate),
      change: formatDelta(metrics.conversionRate, comparison?.conversionRate),
    },
  ];

  const monthlyTrends = dashboard.monthlyTrends.dataPoints.map((point) => ({
    month: point.month,
    consumers: point.consumersSampled,
    purchases: point.purchases,
    conversion: point.conversionRate,
  }));

  const marketAnalysis = dashboard.marketAnalysis.dataPoints.map((point) => ({
    market: point.marketName,
    consumers: point.consumers,
    purchases: point.purchases,
    conversion: point.conversion,
    demos: point.demos,
    efficiency: point.efficiency,
    distributorId: point.marketId,
  }));

  const reachConversion = dashboard.marketAnalysis.dataPoints.map((point) => ({
    market: point.marketName,
    consumers: point.consumers,
    conversion: point.conversion,
  }));

  const rmmPerformance = dashboard.rmmPerformance.dataPoints.map((point) => ({
    rmm: point.rmmName,
    consumers: point.consumersSampled,
    demos: point.demos,
    conversion: point.conversionRate,
  }));

  const retailAccounts = dashboard.marketAnalysis.dataPoints.map(
    (point, index) => ({
      name: point.marketName,
      consumers: point.consumers,
      conversion: point.conversion,
      distributorId: point.marketId,
      color: [
        "#93C5FD",
        "#60A5FA",
        "#34D399",
        "#9CA3AF",
        "#FCD34D",
        "#FCA5A5",
        "#A78BFA",
        "#FDBA74",
      ][index % 8],
    }),
  );

  const quarterStyles = [
    { color: "bg-blue-50 dark:bg-blue-900/10", border: "border-blue-300" },
    { color: "bg-green-50 dark:bg-green-900/10", border: "border-green-300" },
    {
      color: "bg-yellow-50 dark:bg-yellow-900/10",
      border: "border-yellow-300",
    },
    { color: "bg-pink-50 dark:bg-pink-900/10", border: "border-pink-300" },
  ];

  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthLookup = new Map(
    monthLabels.flatMap((label, index) => [
      [label.toLowerCase(), index],
      [
        new Intl.DateTimeFormat("en-US", { month: "long" })
          .format(new Date(2020, index, 1))
          .toLowerCase(),
        index,
      ],
    ]),
  );

  const getMonthIndex = (value: string) => {
    const normalized = value.trim().toLowerCase();

    if (monthLookup.has(normalized)) {
      return monthLookup.get(normalized) ?? null;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.getMonth();
    }

    return null;
  };

  const buildQuarterSummaries = (
    dataPoints: ReadonlyArray<{
      month: string;
      consumersSampled: number;
      purchases: number;
    }>,
  ) => {
    const buckets = new Map<
      string,
      {
        quarter: number;
        year: number | null;
        consumers: number;
        purchases: number;
      }
    >();

    dataPoints.forEach((point) => {
      const monthIndex = getMonthIndex(point.month);
      if (monthIndex === null) return;

      const parsed = new Date(point.month);
      const year = Number.isNaN(parsed.valueOf()) ? null : parsed.getFullYear();

      const quarter = Math.floor(monthIndex / 3) + 1;
      const key = year ? `${year}-Q${quarter}` : `Q${quarter}`;

      const bucket = buckets.get(key) ?? {
        quarter,
        year,
        consumers: 0,
        purchases: 0,
      };

      bucket.consumers += point.consumersSampled;
      bucket.purchases += point.purchases;

      buckets.set(key, bucket);
    });

    return Array.from(buckets.values())
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.quarter - b.quarter)
      .map((bucket) => {
        const months = monthLabels
          .slice((bucket.quarter - 1) * 3, bucket.quarter * 3)
          .join(" - ");

        const conversion =
          bucket.consumers > 0
            ? (bucket.purchases / bucket.consumers) * 100
            : 0;

        const style =
          quarterStyles[(bucket.quarter - 1) % quarterStyles.length];

        return {
          quarter: `Q${bucket.quarter}${
            bucket.year ? ` ${bucket.year}` : ""
          } Summary`,
          months,
          consumers: bucket.consumers,
          purchases: bucket.purchases,
          conversion: Number(conversion.toFixed(1)),
          color: style.color,
          border: style.border,
        };
      });
  };

  const quarterSummaries = buildQuarterSummaries(
    dashboard.monthlyTrends.dataPoints,
  );

  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5 space-y-10">
        <DashboardHeader title="Performance Analytics Dashboard" />

        <FiltersPanel
          onApplyFilters={(nextFilters) => {
            setFilters(nextFilters);
            setFetchKey((k) => k + 1);
          }}
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
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

        <section className="w-full">
          <ChartCard
            title="Monthly Performance Trends"
            icon={CalendarDays}
            iconColor="text-blue-600"
            fixedHeight
          >
            <MonthlyTrendsSection data={monthlyTrends} />
          </ChartCard>
        </section>

        <section className="w-full grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <MarketPerformanceTable data={marketAnalysis} />
          </div>

          <div className="col-span-1">
            <VerticalPerformanceInsights />
          </div>
        </section>

        <section className="w-full">
          <ChartCard
            title="RMM Performance"
            icon={UsersRound}
            iconColor="text-blue-600"
            fixedHeight
          >
            <RmmPerformanceChart data={rmmPerformance} />
          </ChartCard>
        </section>

        <section className="w-full grid grid-cols-2 gap-6">
          <RetailAccountsPerformance data={retailAccounts} />
          <ReachConversionChart data={reachConversion} />
        </section>

        <QuarterSummaryCards data={quarterSummaries} />

        <AiInsightsSection insights={aiInsightsMockV2} isLoading={false} />
      </main>
    </Layout>
  );
}
