import { Card, CardContent } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";
import { Award } from "lucide-react";
import type { ComponentType } from "react";

export interface InsightItem {
  title: string;
  value: string;
  metric: string;
  icon: ComponentType<{ className?: string }>;
  color: string; // ej: "text-amber-600"
  bgColor: string; // ej: "bg-amber-50"
  borderColor: string; // ej: "border-amber-200"
}

interface Props {
  data?: InsightItem[];
  className?: string;
}

export const MarketInsightsList = ({ data = [], className = "" }: Props) => {
  return (
    <div
  className={cn(
    "flex flex-col h-full max-h-[670px] overflow-y-auto px-2 md:px-0 lg:pr-3",
    className
  )}
    >
      {/* Header fijo */}
      <div className="sticky top-0 pb-2 bg-base-100 dark:bg-gray-900 z-10 transition-colors duration-300">
        <h3 className="text-2xl font-bold flex items-center gap-2 text-base-content dark:text-white">
          <Award className="text-amber-600" size={26} />
          <span>Performance Insights</span>
        </h3>
      </div>

      {/* Cards */}
      {data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 pb-4">
          {data.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <Card
                key={index}
                className={cn(
                  "border rounded-xl shadow-sm hover:shadow-md transition-all duration-300 bg-base-100 dark:bg-transparent",
                  `${insight.bgColor} ${insight.borderColor}`
                )}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  {/* Icono */}
                  <div className="p-3 rounded-xl shadow-sm bg-white dark:bg-gray-800 transition-colors duration-300">
                    <Icon className={cn(`${insight.color}`, "w-6 h-6")} />
                  </div>

                  {/* Texto */}
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide">
                      {insight.title}
                    </p>
                    <p className="text-lg sm:text-xl font-bold mt-1 text-base-content dark:text-white">
                      {insight.value}
                    </p>
                    <p className={cn("text-sm font-semibold mt-1", insight.color)}>
                      {insight.metric}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic px-2 py-4">
          No insights available
        </p>
      )}
    </div>
  );
};
