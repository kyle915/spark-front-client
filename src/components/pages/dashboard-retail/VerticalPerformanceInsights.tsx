import { Eye, ShoppingCart, CalendarDays, Target } from "lucide-react";

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

const defaultInsights: InsightItem[] = [
  {
    id: 1,
    label: "TOP CONVERTING MARKET",
    main: "Seattle",
    sub: "32.9% conversion rate",
    subColor: "text-orange-600",
    icon: Target,
    borderFrom: "from-orange-400",
    borderTo: "to-orange-600",
  },
  {
    id: 2,
    label: "HIGHEST WILLINGNESS TO BUY",
    main: "Overall",
    sub: "71% willing to purchase",
    subColor: "text-emerald-600",
    icon: ShoppingCart,
    borderFrom: "from-emerald-400",
    borderTo: "to-emerald-600",
  },
  {
    id: 3,
    label: "STRONGEST BRAND AWARENESS",
    main: "Overall",
    sub: "40% awareness among consumers",
    subColor: "text-blue-600",
    icon: Eye,
    borderFrom: "from-blue-400",
    borderTo: "to-blue-600",
  },
  {
    id: 4,
    label: "MOST ACTIVE MONTH",
    main: "June 2025",
    sub: "35 events • 4,200 consumers",
    subColor: "text-purple-600",
    icon: CalendarDays,
    borderFrom: "from-purple-400",
    borderTo: "to-purple-600",
  },
];

export default function VerticalPerformanceInsights({
  insights = defaultInsights,
}: {
  insights?: InsightItem[];
}) {
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
              className={`
                p-0.5 rounded-2xl bg-linear-to-r ${item.borderFrom} ${item.borderTo}
                shadow-md hover:shadow-xl transition-all duration-300
              `}
            >
              <div
                className="
                  flex gap-4 items-center p-4 rounded-2xl
                  bg-base-100 dark:bg-base-200
                "
              >
                {/* ICON */}
                <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-base-200 dark:bg-base-300 shadow">
                  <item.icon className={`w-7 h-7 ${item.subColor}`} />
                </div>

                {/* TEXT */}
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
