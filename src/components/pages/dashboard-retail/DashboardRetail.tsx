import { useMemo, useState } from "react";
import { format } from "date-fns";
import Layout from "@/layout/Layout";
import { CalendarDays, UsersRound } from "lucide-react";
import FiltersPanel, {
  type FiltersState,
} from "@/components/filters/FiltersPanel";
import ChartCard from "@/components/charts/ChartCard";
import { MetricCard } from "@/components/cards/metric-card";
import { AiInsightsSection } from "@/components/ai-insights/AiInsightsSection";

import DashboardHeader from "../dashboard/DashboardHeader";
import MonthlyTrendsSection from "../dashboard-retail/MonthlyTrendsSection";

import QuarterSummaryCards, {
  type QuarterSummary,
} from "./QuarterSummaryCards";
import MarketPerformanceTable from "./MarketPerformanceTable";
import VerticalPerformanceInsights from "./VerticalPerformanceInsights";
import RmmPerformanceChart from "./RmmPerformanceChart";
import RetailAccountsPerformance from "./RetailAccountsPerformance";
import ReachConversionChart from "./ReachConversionChart";

import { useRecapDashboardData } from "@/hooks/useRecapDashboardData";
import { aiInsightsMockV2 } from "@/data/dashboard-retail/aiInsightsMock";
import { useAuthStore } from "@/store/authStore";

const defaultFilters: FiltersState = {
  distributor: "",
  rmm: "",
  quarter: "",
  dateRange: undefined,
};

const formatNumber = (value: number) => value.toLocaleString();
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatDelta = (current: number, previous?: number | null) => {
  if (!previous || previous === 0) return "0%";
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
};

const quarterStyles = [
  { color: "bg-blue-50 dark:bg-blue-900/10", border: "border-blue-300" },
  { color: "bg-green-50 dark:bg-green-900/10", border: "border-green-300" },
  { color: "bg-yellow-50 dark:bg-yellow-900/10", border: "border-yellow-300" },
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
  ])
);

const getMonthIndex = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (monthLookup.has(normalized)) return monthLookup.get(normalized) ?? null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) return parsed.getMonth();

  return null;
};

const buildQuarterSummaries = (
  dataPoints: ReadonlyArray<{
    month: string;
    consumersSampled: number;
    purchases: number;
  }>
): QuarterSummary[] => {
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
        bucket.consumers > 0 ? (bucket.purchases / bucket.consumers) * 100 : 0;
      const style = quarterStyles[(bucket.quarter - 1) % quarterStyles.length];

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

const colorPalette = [
  "#93C5FD",
  "#60A5FA",
  "#34D399",
  "#9CA3AF",
  "#FCD34D",
  "#FCA5A5",
  "#A78BFA",
  "#FDBA74",
];

export default function DashboardRetail() {
  const { tenantId } = useAuthStore();
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [fetchKey, setFetchKey] = useState(0);

  const filtersInput = useMemo(() => {
    const startDate = filters.dateRange?.from
      ? format(filters.dateRange.from, "yyyy-MM-dd")
      : null;
    const endDate = filters.dateRange?.to
      ? format(filters.dateRange.to, "yyyy-MM-dd")
      : null;

    const input = {
      distributorId: filters.distributor || null,
      rmmId: filters.rmm || null,
      quarter: filters.quarter || null,
      startDate,
      endDate,
    };

    const hasValues = Object.values(input).some((value) => value);
    return hasValues ? input : null;
  }, [filters]);

  const { dashboard, filterOptions } = useRecapDashboardData(
    tenantId || "",
    filtersInput,
    fetchKey
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
        comparison?.totalConsumersSampled
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
    {
      key: "revenueGenerated",
      title: "Revenue Generated",
      value: formatCurrency(metrics.revenueGenerated),
      change: formatDelta(
        metrics.revenueGenerated,
        comparison?.revenueGenerated
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
      color: colorPalette[index % colorPalette.length],
    })
  );

  const quarterSummaries = buildQuarterSummaries(
    dashboard.monthlyTrends.dataPoints
  );

  const topMarket = dashboard.marketAnalysis.dataPoints.reduce(
    (best, current) => {
      if (!best) return current;
      return current.conversion > best.conversion ? current : best;
    },
    null as (typeof dashboard.marketAnalysis.dataPoints)[number] | null
  );

  const insights = [
    {
      id: 1,
      label: "TOP CONVERTING MARKET",
      main: topMarket?.marketName ?? "N/A",
      sub: topMarket
        ? `${formatPercent(topMarket.conversion)} conversion rate`
        : "No data",
      subColor: "text-orange-600",
      icon: UsersRound,
      borderFrom: "from-orange-400",
      borderTo: "to-orange-600",
    },
    {
      id: 2,
      label: "HIGHEST WILLINGNESS TO BUY",
      main: "Overall",
      sub: `${formatPercent(
        dashboard.performanceInsights.willingToPurchasePercentage
      )} willing to purchase`,
      subColor: "text-emerald-600",
      icon: UsersRound,
      borderFrom: "from-emerald-400",
      borderTo: "to-emerald-600",
    },
    {
      id: 3,
      label: "STRONGEST BRAND AWARENESS",
      main: "Overall",
      sub: `${formatPercent(
        dashboard.performanceInsights.brandAwarenessPercentage
      )} awareness among consumers`,
      subColor: "text-blue-600",
      icon: UsersRound,
      borderFrom: "from-blue-400",
      borderTo: "to-blue-600",
    },
    {
      id: 4,
      label: "MOST ACTIVE MONTH",
      main: dashboard.performanceInsights.bestMonth?.month ?? "N/A",
      sub: dashboard.performanceInsights.bestMonth
        ? `${
            dashboard.performanceInsights.bestMonth.recapsCount
          } recaps | ${dashboard.performanceInsights.bestMonth.consumersCount.toLocaleString()} consumers`
        : "No data",
      subColor: "text-purple-600",
      icon: UsersRound,
      borderFrom: "from-purple-400",
      borderTo: "to-purple-600",
    },
  ];

  const distributors =
    filterOptions?.distributors?.map((d) => ({
      value: d.id,
      label: d.name,
    })) ?? [];

  const rmmOptions =
    filterOptions?.rmms?.map((r) => ({
      value: r.id,
      label: r.name,
    })) ?? [];

  const quarterOptions =
    filterOptions?.quarters?.map((q) => ({
      value: q.value,
      label: q.label,
    })) ?? [];

  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5 space-y-10">
        <DashboardHeader title="Performance Analytics Dashboard" />

        <FiltersPanel
          distributors={distributors}
          rmmOptions={rmmOptions}
          quarterOptions={quarterOptions}
          onApplyFilters={(nextFilters) => {
            setFilters(nextFilters);
            setFetchKey((key) => key + 1);
          }}
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
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

        {/* AI INSIGHTS */}
        <AiInsightsSection insights={aiInsightsMockV2} isLoading={false} />

        {/* MONTHLY PERFORMANCE */}
        <section className="w-full">
          <ChartCard
            title="Monthly Performance Trends"
            icon={CalendarDays}
            iconColor="text-blue-600"
            fixedHeight={true}
          >
            <MonthlyTrendsSection data={monthlyTrends} />
          </ChartCard>
        </section>

        <section className="w-full grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <MarketPerformanceTable
              data={marketAnalysis}
              distributors={distributors}
              selectedDistributor={filters.distributor}
              onDistributorChange={(value) => {
                setFilters((prev) => ({ ...prev, distributor: value }));
                setFetchKey((key) => key + 1);
              }}
            />
          </div>

          <div className="col-span-1">
            <VerticalPerformanceInsights insights={insights} />
          </div>
        </section>

        {/* RMM Performance */}
        <section className="w-full">
          <ChartCard
            title="RMM Performance"
            icon={UsersRound}
            iconColor="text-blue-600"
            fixedHeight={true}
          >
            <RmmPerformanceChart data={rmmPerformance} />
          </ChartCard>
        </section>

        <section className="w-full grid grid-cols-2 gap-6">
          <div className="col-span-1">
            <RetailAccountsPerformance data={retailAccounts} />
          </div>

          <div className="col-span-1">
            <ReachConversionChart data={reachConversion} />
          </div>
        </section>

        <section className="w-full">
          <QuarterSummaryCards data={quarterSummaries} />
        </section>
      </main>
    </Layout>
  );
}
