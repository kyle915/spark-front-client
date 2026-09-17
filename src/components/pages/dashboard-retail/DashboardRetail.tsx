import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { CalendarDays, Sparkles, UsersRound } from "lucide-react";
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
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { GenerateInsightsMutation } from "@/api/mutations/GenerateInsightsMutation";
import type { GenerateInsightsMutationType } from "@/api/mutations/GenerateInsightsMutation";
import { computePeriodDelta } from "@/lib/periodDelta";

/* =========================
   Helpers
========================= */

const formatNumber = (value: number) => value.toLocaleString();
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export default function DashboardRetail() {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((state) => state.showAlert);

  const [filters, setFilters] = useState<DashboardFilters>({
    distributorIds: [],
    rmmAsignedId: null,
    quarter: null,
    startDate: null,
    endDate: null,
  });

  const [fetchKey, setFetchKey] = useState(0);
  const [aiInsightsRefreshKey, setAiInsightsRefreshKey] = useState(0);
  const [commitGenerateInsights, isGeneratingInsights] =
    useMutation<GenerateInsightsMutationType>(GenerateInsightsMutation);

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
      current: metrics.totalConsumersSampled,
      previous: comparison?.totalConsumersSampled ?? null,
      delta: computePeriodDelta(
        metrics.totalConsumersSampled,
        comparison?.totalConsumersSampled ?? 0,
      ),
    },
    {
      key: "totalPurchases",
      title: "Total Purchases",
      value: formatNumber(metrics.totalPurchases),
      current: metrics.totalPurchases,
      previous: comparison?.totalPurchases ?? null,
      delta: computePeriodDelta(
        metrics.totalPurchases,
        comparison?.totalPurchases ?? 0,
      ),
    },
    {
      key: "overallConversionRate",
      title: "Overall Conversion Rate",
      value: formatPercent(metrics.conversionRate),
      current: metrics.conversionRate,
      previous: comparison?.conversionRate ?? null,
      delta: computePeriodDelta(
        metrics.conversionRate,
        comparison?.conversionRate ?? 0,
      ),
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

  const handleRegenerateInsights = () => {
    if (!tenantId) {
      showAlert("Select a tenant first to generate insights.", "warning");
      return;
    }

    commitGenerateInsights({
      variables: {
        tenantId,
        fromDate: filters.startDate,
        toDate: filters.endDate,
        enqueue: true,
      },
      onCompleted: (response) => {
        if (response.generateInsights?.success) {
          const enqueued = response.generateInsights.enqueued;
          showAlert(
            enqueued
              ? "Insights regeneration queued successfully."
              : "Insights regenerated successfully.",
            "success",
          );
          setAiInsightsRefreshKey((k) => k + 1);
          return;
        }

        showAlert("Unable to regenerate AI insights.", "error");
      },
      onError: (error) => {
        showAlert(`Error regenerating AI insights: ${error.message}`, "error");
      },
    });
  };

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
              delta={metric.delta}
              current={metric.current}
              previous={metric.previous}
              comparisonLabel={comparisonLabel}
            />
          ))}
        </section>

        <section className="w-full">
          <ChartCard
            title="Monthly Performance Trends"
            icon={CalendarDays}
            iconColor="text-[var(--spark-sky)]"
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
            <VerticalPerformanceInsights
              insightsData={dashboard.performanceInsights}
            />
          </div>
        </section>

        <section className="w-full">
            <ChartCard
            title="RMM Performance"
            icon={UsersRound}
            iconColor="text-[var(--spark-lime)]"
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

        <section className="w-full space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2"
              onClick={handleRegenerateInsights}
              disabled={isGeneratingInsights || !tenantId}
            >
              {isGeneratingInsights ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Sparkles size={16} />
              )}
              {isGeneratingInsights
                ? "Regenerating Insights..."
                : "Regenerate AI-Powered Insights"}
            </button>
          </div>

          <AiInsightsSection
            key={aiInsightsRefreshKey}
            isLoading={isGeneratingInsights}
          />
        </section>
      </main>
    </Layout>
  );
}
