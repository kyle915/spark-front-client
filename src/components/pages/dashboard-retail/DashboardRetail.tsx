import Layout from "@/layout/Layout";
import { CalendarDays, UsersRound } from "lucide-react";
import FiltersPanel from "@/components/filters/FiltersPanel";
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

import { aiInsightsMockV2 } from "@/data/dashboard-retail/aiInsightsMock";
import { performanceMetricsMock } from "@/data/dashboard-retail/performanceMetricsMock";
import { mockMonthlyTrendsAlt } from "@/data/dashboard-retail/monthlyMock";
import { mockMarketPerformance } from "@/data/dashboard-retail/marketMock";
import { mockRmmPerformance } from "@/data/dashboard-retail/RMMMock";
import { retailAccountsMock } from "@/data/dashboard-retail/marketMockRetail";
import { mockReachConversion } from "@/data/dashboard-retail/ReachvsConversionMock";
import { quarterSummaryMock } from "@/data/dashboard-retail/quarterSummaryMock";

export default function DashboardRetail() {
  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5 space-y-10">
        {/* DASHBOARD CONTENT GOES HERE */}
        <DashboardHeader title="Performance Analytics Dashboard" />

        <FiltersPanel
          distributors={["Alice Johnson", "Bob Smith"]}
          rmmOptions={["Emily Davis", "James Wilson"]}
          quarterOptions={["Q1 2024", "Q2 2024", "Q3 2024"]}
          onApplyFilters={(filters) => console.log("Applied filters:", filters)}
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
          {performanceMetricsMock.map((m) => (
            <MetricCard
              key={m.metricKey}
              metricKey={m.metricKey}
              title={m.title}
              value={m.value}
              change={m.change}
              variant={m.variant as "success"}
            // icon={m.icon}
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
            <MonthlyTrendsSection data={mockMonthlyTrendsAlt} />
          </ChartCard>
        </section>

        <section className="w-full grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <MarketPerformanceTable data={mockMarketPerformance} />
          </div>

          <div className="col-span-1">
            <VerticalPerformanceInsights />
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
            <RmmPerformanceChart data={mockRmmPerformance} />
          </ChartCard>
        </section>

        <section className="w-full grid grid-cols-2 gap-6">
          <div className="col-span-1">
            <RetailAccountsPerformance data={retailAccountsMock} />
          </div>

          <div className="col-span-1">
            <ReachConversionChart data={mockReachConversion} />
          </div>
        </section>

        <section className="w-full">
          <QuarterSummaryCards data={quarterSummaryMock} />
        </section>
      </main>
    </Layout>
  );
}
