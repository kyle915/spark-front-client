import { cn } from "../../lib/utils";
import type { ComponentType, ReactNode } from "react";

interface ChartCardProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  fixedHeight?: boolean;
}

export default function ChartCard({
  title,
  icon: Icon,
  iconColor = "text-primary",
  children,
  className,
  fixedHeight = false,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "card bg-base-100 border border-base-200 shadow-md rounded-xl p-6 w-full",
        "dark:bg-base-100 dark:border-base-300",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Icon className={cn(iconColor, "w-6 h-6")} />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>

      <div
        className={cn(
          "w-full",
          fixedHeight &&
            "h-[340px] sm:h-[380px] md:h-[420px] lg:h-[460px] overflow-y-auto pr-1"
        )}
      >
        {children}
      </div>
    </div>
  );
}
