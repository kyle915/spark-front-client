import { Gauge } from "lucide-react";
import { memo, useMemo } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";
import ChartCard from "@/components/charts/ChartCard";

export type GoalItem = {
  label: string;
  current: number;
  target: number;
};

export default memo(function GoalsProgressSection({
  goals,
}: {
  goals: GoalItem[];
}) {
  const [isDark] = useThemeMode();

  const { subtleColor, barBg } = useMemo(() => {
    return {
      subtleColor: isDark ? "#94a3b8" : "#64748b",
      barBg: isDark ? "rgba(var(--spark-ink-rgb),0.15)" : "rgba(0,0,0,0.12)",
    };
  }, [isDark]);

  return (
    <ChartCard
      title="2026 Goals Progress"
      icon={Gauge}
      iconColor="text-primary"
      fixedHeight
    >
      <div className="space-y-6 p-1 max-w-full overflow-hidden">
        {goals.map((goal) => {
          const percent =
            goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
          const progressWidth = Math.min(Math.max(percent, 0), 100);

          return (
            <div key={goal.label} className="space-y-1 max-w-full">
              {/* TOP ROW */}
              <div className="flex justify-between text-sm flex-wrap">
                <span className="font-semibold wrap-break-words">
                  {goal.label}
                </span>

                <span className="font-semibold px-1 whitespace-nowrap">
                  {goal.current.toLocaleString()} /{" "}
                  {goal.target.toLocaleString()}
                </span>
              </div>

              {/* PROGRESS BAR */}
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: barBg }}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>

              {/* SUBTEXT */}
              <span
                className="text-xs font-medium block"
                style={{ color: subtleColor }}
              >
                {percent}% complete
              </span>

              {/* Divider */}
              <div className="w-full border-b" style={{ borderColor: barBg }} />
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
});
