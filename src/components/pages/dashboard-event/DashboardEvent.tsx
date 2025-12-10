import Layout from "@/layout/Layout";
import { MetricCard } from "../../cards/metric-card";
import FiltersPanel from "../../filters/FiltersPanel";
import ChartCard from "../../charts/ChartCard";

import { CalendarDays, CalendarClockIcon } from "lucide-react";

import DashboardHeader from "../dashboard/DashboardHeader";

import MonthlyTrendsChart from "../dashboard-event/MonthlyTrendsSection";
import DemographicInsightSection from "../dashboard-event/DemographicInsightSection";
import PerformanceInsights from "../dashboard-event/PerformanceInsights";
import GoalsProgressSection from "../dashboard-event/GoalsProgressSection";
import RegionalMarketPerformance from "../dashboard-event/RegionalMarketPerformance";
import RecentEventsCarousel from "../dashboard-event/RecentEventsCarousel";

// Hooks
import { useDashboardData } from "@/hooks/useDashboardData";
import { AiInsightsSection } from "@/components/ai-insights/AiInsightsSection";

// Mock Data
import { aiInsightsMock } from "../../../data/dashboard-events/aiInsightsMock";
import { mockMonthlyTrends } from "../../../data/dashboard-events/monthlyMock";
import { regionalMarketMock } from "../../../data/dashboard-events/regionalMarketMock";
import { recentEventsMock } from "../../../data/dashboard-events/eventsRecentsMock";

export default function DashboardIndex() {
  const { metrics: gqlMetrics } = useDashboardData();

  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-5 space-y-10">
        {/* HEADER */}
        <DashboardHeader title="Event Recap Dashboard" />

        {/* FILTERS */}
        <FiltersPanel
          distributors={["John Doe", "Jane Smith"]}
          rmmOptions={["Michael Brown", "Sarah Williams"]}
          quarterOptions={["Q1 2025", "Q2 2025", "Q3 2025"]}
          onApplyFilters={(filters) => console.log("Applied filters:", filters)}
        />

        {/* METRICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.entries(gqlMetrics).map(([key, value]) => (
            <MetricCard
              key={key}
              metricKey={key}
              title={key.replace(/([A-Z])/g, " $1")}
              value={String(value)}
              change="5%"
              variant="success"
              icon={<CalendarClockIcon className="text-blue-600" />}
            />
          ))}
        </section>

        {/* AI INSIGHTS */}
        <AiInsightsSection insights={aiInsightsMock} isLoading={false} />

        {/* MONTHLY PERFORMANCE */}
        <section className="w-full">
          <ChartCard
            title="Monthly Performance Trends"
            icon={CalendarDays}
            iconColor="text-blue-600"
            fixedHeight={true}
          >
            <MonthlyTrendsChart data={mockMonthlyTrends} />
          </ChartCard>
        </section>

        {/* DEMOGRAPHIC INSIGHTS */}
        <section className="w-full ">
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
        </section>

        {/* PERFORMANCE INSIGHTS */}
        <section className="w-full">
          <PerformanceInsights />
        </section>

        <section className="w-full grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <GoalsProgressSection
              goals={[
                { label: "Events Target", current: 130, target: 200 },
                { label: "Consumer Sampling", current: 12500, target: 25000 },
                { label: "Brand Awareness", current: 40, target: 50 },
                { label: "Purchase Intent", current: 65.4, target: 75 },
                { label: "Female Participation", current: 58, target: 65 },
                { label: "First-Time Buyers", current: 62, target: 70 },
                { label: "First-Time Buyers-2", current: 62, target: 70 },
                { label: "First-Time Buyers-3", current: 62, target: 70 },
                { label: "First-Time Buyers-4", current: 62, target: 70 },
              ]}
            />
          </div>

          <div className="col-span-2">
            <RegionalMarketPerformance data={regionalMarketMock} />
          </div>
        </section>

        <section className="w-full">
          <RecentEventsCarousel events={recentEventsMock} />
        </section>
      </main>
    </Layout>
  );
}
