import { Eye, ShoppingCart, CalendarDays, Target } from "lucide-react";

const insights = [
  {
    id: 1,
    title: "KNEW ABOUT BRAND",
    value: "4,992",
    subtitle: "40.0% of sampled",
    icon: Eye,
    border: "border-amber-300",
    bg: "bg-amber-50 dark:bg-amber-300/10",
    accent: "text-amber-600",
  },
  {
    id: 2,
    title: "WILLING TO PURCHASE",
    value: "8,736",
    subtitle: "70.0% of sampled",
    icon: ShoppingCart,
    border: "border-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-300/10",
    accent: "text-emerald-600",
  },
  {
    id: 3,
    title: "BEST MONTH",
    value: "June 2025",
    subtitle: "35 events | 4,200 consumers",
    icon: CalendarDays,
    border: "border-purple-300",
    bg: "bg-purple-50 dark:bg-purple-300/10",
    accent: "text-purple-600",
  },
  {
    id: 4,
    title: "GROWTH RATE",
    value: "+34.6%",
    subtitle: "Events vs last year",
    icon: Target,
    border: "border-orange-300",
    bg: "bg-orange-50 dark:bg-orange-300/10",
    accent: "text-orange-600",
  },
];

export default function PerformanceInsights() {
  return (
    <section className="space-y-6 w-full">
      <h2 className="text-xl font-bold flex items-center gap-2 justify-center">
        <Target className="text-primary w-6 h-6" />
        Performance Insights
      </h2>

      {/* WRAPPER CON SCROLL ADAPTATIVO */}
      <div
        className="
          flex flex-col gap-6
          sm:grid sm:grid-cols-2 
          xl:grid-cols-4
          overflow-x-auto sm:overflow-visible
          pb-3 no-scrollbar
        "
        style={{ scrollSnapType: "x mandatory" }}
      >
        {insights.map((item) => (
          <div
            key={item.id}
            className={`
              min-w-[260px] 
              p-5 rounded-xl border ${item.border} ${item.bg}
              transition-colors flex flex-col justify-between h-full
              hover:shadow-lg hover:scale-[1.03]
              scroll-snap-align-start
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
