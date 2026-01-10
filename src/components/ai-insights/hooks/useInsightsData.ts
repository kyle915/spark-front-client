// src/components/ai-insights/hooks/useInsightsData.ts
import { useState, useEffect } from "react";
import type { AIInsightItem } from "../types";

export function useInsightsData() {
  const [insights, setInsights] = useState<AIInsightItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simula fetch o llamada a API
    setTimeout(() => {
      setInsights([
        {
          id: "1",
          title: "Increase in Conversion Rate",
          description: "Customer conversions rose by 12% this quarter.",
          priority: "High",
          category: "Metric Trends",
          iconLucide: "TrendingUp",
        },
        {
          id: "2",
          title: "Positive Feedback Surge",
          description: "Customer satisfaction improved by 8% month over month.",
          priority: "Medium",
          category: "Customer Feedback",
          iconLucide: "MessageSquare",
        },
        {
          id: "3",
          title: "Product Sentiment Stable",
          description: "Sentiment around packaging remains neutral overall.",
          priority: "Low",
          category: "Product Analysis",
          iconLucide: "Package",
        },
      ]);
      setLoading(false);
    }, 1200);
  }, []);

  return { insights, loading };
}
