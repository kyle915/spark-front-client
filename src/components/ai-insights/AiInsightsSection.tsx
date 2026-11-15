import { useMemo, useState } from "react";
import { MessageSquare, TrendingUp, Package } from "lucide-react";
import { useLazyLoadQuery } from "react-relay/hooks";

import { AiInsightCard } from "./AiInsightCard";
import type { AIInsightItem } from "./types";
import { AiInsightsSkeleton } from "./AiInsightsSkeleton";
import { LatestInsightsQuery } from "@/api/queries/LatestInsightsQuery";
import type { LatestInsightsQuery as LatestInsightsQueryType } from "@/api/queries/__generated__/LatestInsightsQuery.graphql";
import { InsightsAggregatesQuery } from "@/api/queries/InsightsAggregatesQuery";
import type { InsightsAggregatesQuery as InsightsAggregatesQueryType } from "@/api/queries/__generated__/InsightsAggregatesQuery.graphql";
import { useAuthStore } from "@/store/authStore";

interface Props {
  insights?: AIInsightItem[];
  isLoading?: boolean;
}

const focusTabs = [
  {
    value: "feedback",
    label: "Customer Feedback Analysis",
    icon: <MessageSquare size={18} />,
    category: "Customer Feedback",
    description:
      "AI-powered analysis of customer satisfaction, service quality, and overall experience feedback.",
  },
  {
    value: "trends",
    label: "Metric Behavior & Trends",
    icon: <TrendingUp size={18} />,
    category: "Metric Trends",
    description:
      "Key performance metrics, conversions, and pattern recognition over time from recap aggregates.",
  },
  {
    value: "products",
    label: "Product Comments Analysis",
    icon: <Package size={18} />,
    category: "Product Analysis",
    description:
      "SKU sampling and sales breakdown from filed recaps — top movers and week-over-week shifts.",
  },
];

function useAggregateInsights(tenantId: string) {
  const year = new Date().getFullYear();
  const aggregateStart = `${year}-01-01`;
  const aggregateEnd = new Date().toISOString().slice(0, 10);

  const aggregateData = useLazyLoadQuery<InsightsAggregatesQueryType>(
    InsightsAggregatesQuery,
    {
      tenantId,
      year,
      startDate: aggregateStart,
      endDate: aggregateEnd,
    },
    { fetchPolicy: "store-and-network" },
  );

  const trendInsights = useMemo((): AIInsightItem[] => {
    const kpis = aggregateData.tenantKpis;
    if (!kpis) return [];
    const months = kpis.monthlyTrend ?? [];
    const latest = months[months.length - 1];
    const prior = months[months.length - 2];
    const items: AIInsightItem[] = [
      {
        id: "trend-recaps",
        title: `${kpis.recaps.toLocaleString()} recaps filed YTD`,
        description: `${kpis.consumersReached.toLocaleString()} consumers reached · ${kpis.samplesDistributed.toLocaleString()} samples distributed.`,
        priority: "Medium",
        category: "Metric Trends",
        iconLucide: "TrendingUp",
      },
    ];
    if (latest && prior) {
      const sampleDelta = latest.samples - prior.samples;
      const dir = sampleDelta >= 0 ? "up" : "down";
      items.unshift({
        id: "trend-month",
        title: `${latest.month}: ${latest.samples.toLocaleString()} samples`,
        description: `${dir === "up" ? "↑" : "↓"} ${Math.abs(sampleDelta).toLocaleString()} vs prior month · ${latest.engagements.toLocaleString()} engagements.`,
        priority: Math.abs(sampleDelta) > 50 ? "High" : "Low",
        category: "Metric Trends",
        iconLucide: "TrendingUp",
      });
    }
    return items;
  }, [aggregateData.tenantKpis]);

  const productInsights = useMemo((): AIInsightItem[] => {
    const ytd =
      aggregateData.tenantFieldSamplingReport?.ytdSkuBreakdown?.items ?? [];
    const week =
      aggregateData.tenantFieldSamplingReport?.weekSkuBreakdown?.items ?? [];
    const topYtd = [...ytd].sort((a, b) => b.total - a.total).slice(0, 3);
    const topWeek = [...week].sort((a, b) => b.total - a.total).slice(0, 3);
    const items: AIInsightItem[] = topYtd.map((row, i) => ({
      id: `sku-ytd-${i}`,
      title: row.product || "Unknown SKU",
      description: `${row.total.toLocaleString()} units sampled YTD.`,
      priority: i === 0 ? "High" : "Medium",
      category: "Product Analysis",
      iconLucide: "Package",
    }));
    if (topWeek[0]) {
      items.unshift({
        id: "sku-week-leader",
        title: `This week: ${topWeek[0].product}`,
        description: `${topWeek[0].total.toLocaleString()} units — leading SKU in the last 7 days.`,
        priority: "High",
        category: "Product Analysis",
        iconLucide: "Package",
      });
    }
    return items;
  }, [aggregateData.tenantFieldSamplingReport]);

  return { trendInsights, productInsights };
}

function AiInsightsWithAggregates({
  insights,
  isLoading,
  tenantId,
}: Props & { tenantId: string }) {
  const [activeTab, setActiveTab] = useState(focusTabs[0].value);
  const { trendInsights, productInsights } = useAggregateInsights(tenantId);

  const latestInsightsData = useLazyLoadQuery<LatestInsightsQueryType>(
    LatestInsightsQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );

  const normalizePriority = (
    value?: string | null,
  ): AIInsightItem["priority"] => {
    const normalized = value?.toLowerCase();
    if (normalized === "high") return "High";
    if (normalized === "medium") return "Medium";
    if (normalized === "low") return "Low";
    return "Low";
  };

  const feedbackInsights = useMemo(() => {
    const reports = latestInsightsData.latestInsights?.reports ?? [];
    return reports.map((report) => ({
      id: report.id,
      title: report.title || "Untitled Insight",
      description: report.content || "No details available yet.",
      priority: normalizePriority(report.priority),
      category: "Customer Feedback",
      iconLucide: "MessageSquare",
    }));
  }, [latestInsightsData.latestInsights?.reports]);

  const combinedInsights = useMemo(() => {
    const server = [...feedbackInsights, ...trendInsights, ...productInsights];
    if (!feedbackInsights.length) {
      return [...(insights ?? []), ...trendInsights, ...productInsights];
    }
    const nonFeedback = (insights ?? []).filter(
      (insight) => insight.category !== "Customer Feedback",
    );
    return [...nonFeedback, ...server];
  }, [feedbackInsights, trendInsights, productInsights, insights]);

  const totalNewInsights =
    feedbackInsights.length + trendInsights.length + productInsights.length;

  const renderInsightsByPriority = (items: AIInsightItem[]) => {
    if (!items.length) {
      return (
        <div className="rounded-xl border border-dashed border-base-300 bg-base-200/50 p-6 text-center text-base-content/70">
          No data available.
        </div>
      );
    }

    const high = items.filter((i) => i.priority === "High");
    const medium = items.filter((i) => i.priority === "Medium");
    const low = items.filter((i) => i.priority === "Low");

    return (
      <div className="transition-colors duration-300">
        {high.length > 0 && (
          <div className="mb-6">
            <AiInsightCard insight={high[0]} compact={false} />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {[...high.slice(1), ...medium, ...low].map((insight, i) => (
            <AiInsightCard key={i} insight={insight} compact />
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) return <AiInsightsSkeleton />;

  return (
    <div className="w-full relative rounded-2xl p-0.5 overflow-hidden">
      <div
        className="
          relative rounded-2xl 
          bg-base-100 dark:bg-base-100
          border border-base-300/60 
          shadow-lg 
          transition-colors duration-300
          p-0
        "
      >
        <div className="flex items-center gap-3 px-6 pt-6 transition-colors duration-300">
          <h2 className="text-2xl font-extrabold">AI-Powered Insights</h2>
          <span className="ml-3 badge badge-primary badge-lg font-semibold gap-1 rounded-full">
            {totalNewInsights} New
          </span>
        </div>

        <div className="mt-6 px-6 transition-colors duration-300">
          <div
            className="
              flex flex-wrap gap-2 justify-between 
              bg-base-200/70 dark:bg-base-300/20
              rounded-lg p-2
              transition-colors duration-300
            "
          >
            {focusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer
                  transition-all duration-300
                  ${
                    activeTab === tab.value
                      ? "bg-primary text-primary-content shadow-md"
                      : "text-base-content/70 hover:bg-base-300/90 hover:shadow-md dark:hover:bg-base-300/10"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-6 pb-8 transition-colors duration-300">
            {focusTabs.map(
              (tab) =>
                tab.value === activeTab && (
                  <div key={tab.value}>
                    <h3 className="text-xl font-bold mb-2">{tab.label}</h3>
                    <p className="text-base-content/70 mb-6">{tab.description}</p>
                    {renderInsightsByPriority(
                      combinedInsights.filter((i) => i.category === tab.category),
                    )}
                  </div>
                ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiInsightsSection({
  insights = [],
  isLoading = false,
}: Props) {
  const tenantId = useAuthStore((state) => state.tenantId);

  if (!tenantId) {
    return (
      <div className="w-full relative rounded-2xl p-0.5 overflow-hidden">
        <div className="relative rounded-2xl bg-base-100 border border-base-300/60 shadow-lg p-6">
          <div className="rounded-xl border border-dashed border-base-300 bg-base-200/60 p-6 text-center text-base-content/70">
            Please select a tenant to view AI insights.
          </div>
        </div>
      </div>
    );
  }

  return (
    <AiInsightsWithAggregates
      insights={insights}
      isLoading={isLoading}
      tenantId={tenantId}
    />
  );
}
