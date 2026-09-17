import { cn } from "../../lib/utils";
import type { ComponentType, CSSProperties, ReactNode } from "react";

interface ChartCardProps {
  title: string;
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  fixedHeight?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

/**
 * Shared chart shell — spark-card chrome + Insights lime/sky palette.
 * Keep Chart.js inside; this only frames the chart.
 */
export default function ChartCard({
  title,
  icon: Icon,
  iconColor = "text-[var(--spark-lime)]",
  children,
  className,
  fixedHeight = false,
  empty = false,
  emptyMessage = "No data for this range yet.",
}: ChartCardProps) {
  return (
    <div className={cn("spark-card p-5 w-full", className)} style={{ borderRadius: 20 }}>
      <div className="mb-4 flex items-center gap-3">
        {Icon ? (
          <Icon className={cn(iconColor, "w-5 h-5 shrink-0")} />
        ) : null}
        <h2
          className="spark-title text-lg font-semibold"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
      </div>

      {empty ? (
        <div
          className={cn(
            "w-full grid place-items-center text-sm",
            fixedHeight
              ? "h-[220px] sm:h-[280px] md:h-[340px]"
              : "min-h-[180px]",
          )}
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div
          className={cn(
            "w-full",
            fixedHeight &&
              "h-[220px] sm:h-[280px] md:h-[340px] lg:h-[400px] overflow-y-auto pr-1",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
