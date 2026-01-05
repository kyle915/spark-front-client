import { Eye, ShoppingCart, CalendarDays, Target } from "lucide-react";

type PerformanceInsightsData = {
  knewAboutBrand: number;
  knewAboutBrandPercentage: number;
  willingToPurchase: number;
  willingToPurchasePercentage: number;
  bestMonth?: {
    month: string;
    eventsCount: number;
    consumersCount: number;
  } | null;
  growthRate: number;
};

export default function PerformanceInsights({
  data,
}: {
  data: PerformanceInsightsData;
}) {
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  const bestMonth = data.bestMonth;

  const insights = [
    {
      id: 1,
      title: "KNEW ABOUT BRAND",
      value: formatNumber(data.knewAboutBrand),
      subtitle: `${formatPercent(data.knewAboutBrandPercentage)} of sampled`,
      icon: Eye,
      border: "border-amber-300",
      bg: "bg-amber-50 dark:bg-amber-300/10",
      accent: "text-amber-600",
    },
    {
      id: 2,
      title: "WILLING TO PURCHASE",
      value: formatNumber(data.willingToPurchase),
      subtitle: `${formatPercent(data.willingToPurchasePercentage)} of sampled`,
      icon: ShoppingCart,
      border: "border-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-300/10",
      accent: "text-emerald-600",
    },
    {
      id: 3,
      title: "BEST MONTH",
      value: bestMonth?.month ?? "N/A",
      subtitle: bestMonth
        ? `${
            bestMonth.eventsCount
          } events · ${bestMonth.consumersCount.toLocaleString()} consumers`
        : "No data",
      icon: CalendarDays,
      border: "border-purple-300",
      bg: "bg-purple-50 dark:bg-purple-300/10",
      accent: "text-purple-600",
    },
    {
      id: 4,
      title: "GROWTH RATE",
      value: `${data.growthRate >= 0 ? "+" : ""}${formatPercent(
        data.growthRate
      )}`,
      subtitle: "Events vs last period",
      icon: Target,
      border: "border-orange-300",
      bg: "bg-orange-50 dark:bg-orange-300/10",
      accent: "text-orange-600",
    },
  ];

  return (
    <section className="space-y-6 w-full">
      <h2 className="text-xl font-bold flex items-center gap-2 justify-center">
        <Target className="text-primary w-6 h-6" />
        Performance Insights
      </h2>

      {/* GRID RESPONSIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {insights.map((item) => (
          <div
            key={item.id}
            className={`
              p-5 rounded-xl border ${item.border} ${item.bg}
              flex flex-col justify-between
              transition-all
              hover:shadow-lg hover:scale-[1.02]
            `}
          >
            {/* ICON */}
            <div className="flex items-center mb-3">
              <div
                className={`
                  p-3 rounded-lg border ${item.border}
                  bg-white dark:bg-base-100 shadow-sm
                `}
              >
                <item.icon className="w-6 h-6 text-base-content/80" />
              </div>
            </div>

            {/* TITLE */}
            <div className="text-sm font-medium text-base-content/70">
              {item.title}
            </div>

            {/* VALUE */}
            <div className="text-3xl font-extrabold text-base-content mt-1">
              {item.value}
            </div>

            {/* SUBTEXT */}
            <div className={`text-sm font-semibold mt-2 ${item.accent}`}>
              {item.subtitle}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
