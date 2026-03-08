import { Eye, ShoppingCart, CalendarDays, Target } from "lucide-react";

type InsightsData = {
  highestWillingnessToBuy?: {
    marketName: string;
    willingCount: number;
  } | null;

  strongestBrandAwareness?: {
    marketName: string;
    brandAwareCount: number;
  } | null;

  topConvertingMarket?: {
    marketName: string;
    conversionRate: number;
  } | null;

  bestMonth?: {
    month: string;
    recapsCount: number;
    consumersCount: number;
  } | null;
};

type InsightItem = {
  id: number;
  label: string;
  main: string;
  sub: string;
  subColor: string;
  icon: typeof Target;
  borderFrom: string;
  borderTo: string;
};

function formatMonth(month: string) {
  try {
    const date = new Date(month);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return month;
  }
}

function buildInsights(data?: InsightsData): InsightItem[] {
  if (!data) return [];

  const insights: InsightItem[] = [];

  if (data.topConvertingMarket) {
    insights.push({
      id: 1,
      label: "TOP CONVERTING MARKET",
      main: data.topConvertingMarket.marketName,
      sub: `${data.topConvertingMarket.conversionRate}% conversion rate`,
      subColor: "text-orange-600",
      icon: Target,
      borderFrom: "from-orange-400",
      borderTo: "to-orange-600",
    });
  }

  if (data.highestWillingnessToBuy) {
    insights.push({
      id: 2,
      label: "HIGHEST WILLINGNESS TO BUY",
      main: data.highestWillingnessToBuy.marketName,
      sub: `${data.highestWillingnessToBuy.willingCount.toLocaleString()} consumers willing`,
      subColor: "text-emerald-600",
      icon: ShoppingCart,
      borderFrom: "from-emerald-400",
      borderTo: "to-emerald-600",
    });
  }

  if (data.strongestBrandAwareness) {
    insights.push({
      id: 3,
      label: "STRONGEST BRAND AWARENESS",
      main: data.strongestBrandAwareness.marketName,
      sub: `${data.strongestBrandAwareness.brandAwareCount.toLocaleString()} aware consumers`,
      subColor: "text-blue-600",
      icon: Eye,
      borderFrom: "from-blue-400",
      borderTo: "to-blue-600",
    });
  }

  if (data.bestMonth) {
    insights.push({
      id: 4,
      label: "MOST ACTIVE MONTH",
      main: formatMonth(data.bestMonth.month),
      sub: `${data.bestMonth.recapsCount} events • ${data.bestMonth.consumersCount.toLocaleString()} consumers`,
      subColor: "text-purple-600",
      icon: CalendarDays,
      borderFrom: "from-purple-400",
      borderTo: "to-purple-600",
    });
  }

  return insights;
}

export default function VerticalPerformanceInsights({
  insightsData,
}: {
  insightsData?: InsightsData;
}) {
  const insights = buildInsights(insightsData);

  if (!insights.length) return null;

  return (
    <section className="space-y-4 w-full flex flex-col">
      <h2 className="text-xl font-bold flex items-center gap-2 justify-center">
        <Target className="text-primary w-6 h-6" />
        Performance Insights
      </h2>

      <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
        <div className="flex flex-col gap-4 pb-2">
          {insights.map((item) => (
            <div
              key={item.id}
              className={`p-0.5 rounded-2xl bg-linear-to-r ${item.borderFrom} ${item.borderTo}
              shadow-md hover:shadow-xl transition-all duration-300`}
            >
              <div className="flex gap-4 items-center p-4 rounded-2xl bg-base-100 dark:bg-base-200">
                <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-base-200 dark:bg-base-300 shadow">
                  <item.icon className={`w-7 h-7 ${item.subColor}`} />
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-base-content/60 tracking-wide">
                    {item.label}
                  </span>

                  <span className="text-lg font-bold text-base-content">
                    {item.main}
                  </span>

                  <span className={`text-sm font-semibold ${item.subColor}`}>
                    {item.sub}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
