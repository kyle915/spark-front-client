import { useMemo, useState } from "react";
import {
  Sparkles,
  MessageSquare,
  TrendingUp,
  Package,
  Brain,
} from "lucide-react";
import { useLazyLoadQuery } from "react-relay/hooks";

import { AiInsightCard } from "./AiInsightCard";
import type { AIInsightItem } from "./types";
import { AiInsightsSkeleton } from "./AiInsightsSkeleton";
import { LatestInsightsQuery } from "@/api/queries/LatestInsightsQuery";
import type { LatestInsightsQuery as LatestInsightsQueryType } from "@/api/queries/__generated__/LatestInsightsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

interface Props {
  insights: AIInsightItem[];
  isLoading: boolean;
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
    disabled: true,
    description:
      "Analysis of key performance metrics, conversions, and pattern recognition over time.",
  },
  {
    value: "products",
    label: "Product Comments Analysis",
    icon: <Package size={18} />,
    category: "Product Analysis",
    disabled: true,
    description:
      "AI-based interpretation of customer sentiment toward product design, packaging, and quality.",
  },
];

export function AiInsightsSection({ insights, isLoading }: Props) {
  const [activeTab, setActiveTab] = useState(focusTabs[0].value);
  const tenantId = useAuthStore((state) => state.tenantId);
  const latestInsightsData = useLazyLoadQuery<LatestInsightsQueryType>(
    LatestInsightsQuery,
    { tenantId: tenantId ?? null },
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
    if (!feedbackInsights.length) return insights;
    const nonFeedback = insights.filter(
      (insight) => insight.category !== "Customer Feedback",
    );
    return [...nonFeedback, ...feedbackInsights];
  }, [feedbackInsights, insights]);

  const totalNewInsights = tenantId ? feedbackInsights.length : 0;

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
        {/* High Priority (full width) */}
        {high.length > 0 && (
          <div className="mb-6">
            <AiInsightCard insight={high[0]} compact={false} />
          </div>
        )}

        {/* Medium + Low */}
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
      {/* Glow Border Background */}
      <div
        className="
          absolute inset-0 rounded-2xl 
          blur-[28px]
          bg-linear-to-r from-primary via-yellow-300 to-cyan-400
          dark:bg-linear-to-r dark:from-success dark:via-indigo-500 dark:to-green-400
          animate-border-flow
        "
      />

      {/* Main container */}
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
        {/* HEADER */}
        <div className="flex items-center gap-3 px-6 pt-6 transition-colors duration-300">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
            <Brain className="text-white" size={22} />
          </div>

          <h2 className="text-2xl font-extrabold">AI-Powered Insights</h2>

          <span className="ml-3 badge badge-primary badge-lg font-semibold gap-1 rounded-full">
            <Sparkles size={14} /> {totalNewInsights} New
          </span>
        </div>

        {/* TABS */}
        <div className="mt-6 px-6 transition-colors duration-300">
          {!tenantId ? (
            <div className="pb-8">
              <div className="rounded-xl border border-dashed border-base-300 bg-base-200/60 p-6 text-center text-base-content/70">
                Please select a tenant to view AI feedback insights.
              </div>
            </div>
          ) : (
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
                  onClick={() => {
                    if (!tab.disabled) setActiveTab(tab.value);
                  }}
                  disabled={tab.disabled}
                  aria-disabled={tab.disabled}
                  className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer
                  transition-all duration-300
                  ${
                    tab.disabled
                      ? "cursor-not-allowed opacity-50 bg-base-200/60 text-base-content/40"
                      : activeTab === tab.value
                        ? "bg-primary text-primary-content shadow-md"
                        : "text-base-content/70 hover:bg-base-300/90 hover:shadow-md dark:hover:bg-base-300/10"
                  }
                `}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.disabled && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* CONTENT */}
          <div className="pt-6 pb-8 transition-colors duration-300">
            {!tenantId ? null : (
              <>
                {focusTabs.map(
                  (tab) =>
                    tab.value === activeTab && (
                      <div key={tab.value}>
                        <h3 className="text-xl font-bold mb-2">{tab.label}</h3>
                        <p className="text-base-content/70 mb-6">
                          {tab.description}
                        </p>

                        {renderInsightsByPriority(
                          combinedInsights.filter(
                            (i) => i.category === tab.category,
                          ),
                        )}
                      </div>
                    ),
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
