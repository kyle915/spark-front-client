import { cn } from "@/lib/utils";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { BarChart3 } from "lucide-react";

interface ChartCardProps {
  title: string;
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  fixedHeight?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  /** Optional dense subtitle under the title (Tremor chart-card pattern). */
  subtitle?: string;
}

/**
 * Shared chart shell — spark-card chrome + Tremor-style empty hatch.
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
  subtitle,
}: ChartCardProps) {
  const heightCls = fixedHeight
    ? "h-[220px] sm:h-[280px] md:h-[340px] lg:h-[400px]"
    : "min-h-[180px]";

  return (
    <div
      className={cn("spark-card p-5 w-full", className)}
      style={{ borderRadius: 20 }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {Icon ? (
              <Icon className={cn(iconColor, "w-5 h-5 shrink-0")} />
            ) : null}
            <h2 className="spark-title text-lg font-semibold">
              {title}
            </h2>
          </div>
          {subtitle ? (
            <p
              className="text-xs mt-1.5"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {empty ? (
        <div className={cn("spark-chart-empty", heightCls)}>
          <div className="flex flex-col items-center gap-2 max-w-[220px]">
            <BarChart3
              className="w-5 h-5 opacity-50"
              style={{ color: "var(--spark-lime)" }}
              aria-hidden
            />
            <span>{emptyMessage}</span>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "w-full",
            fixedHeight && `${heightCls} overflow-y-auto pr-1`,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
