import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MessageSquare, TrendingUp, Package, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AIInsightItem } from "./types";

interface Props {
  insight: AIInsightItem;
  compact?: boolean;
}

const priorityUI = {
  High: {
    border: "border-l-8 border-error",
    bg: "bg-error/10 dark:bg-error/15",
    hoverBg: "hover:bg-error/20 dark:hover:bg-error/25",
    badge: "text-error bg-error/10 border-error/40",
    iconWrapper: "bg-error text-white",
  },
  Medium: {
    border: "border-l-8 border-amber-500",
    bg: "bg-amber-100/40 dark:bg-amber-500/10",
    hoverBg: "hover:bg-amber-200/40 dark:hover:bg-amber-500/20",
    badge: "text-amber-600 bg-amber-100 dark:bg-amber-400/20 border-amber-300",
    iconWrapper: "bg-amber-500 text-white",
  },
  Low: {
    border: "border-l-8 border-green-500",
    bg: "bg-green-100/40 dark:bg-green-500/10",
    hoverBg: "hover:bg-green-200/40 dark:hover:bg-green-500/20",
    badge: "text-green-600 bg-green-100 dark:bg-green-400/20 border-green-300",
    iconWrapper: "bg-green-500 text-white",
  },
};

export function AiInsightCard({ insight, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const Icon: LucideIcon =
    { MessageSquare, TrendingUp, Package }[insight.iconLucide] ?? MessageSquare;

  const style = priorityUI[insight.priority] ?? priorityUI.Low;

  return (
    <div
      className={cn(
        "card rounded-xl transition-all duration-300",
        "bg-base-100 text-base-content border border-base-300/60",
        "shadow-sm hover:shadow-lg hover:-translate-y-0.5",
        style.border,
        style.bg,
        style.hoverBg,
      )}
    >
      <div className={cn("card-body", compact ? "p-4 gap-3" : "p-6 gap-4")}>
        {/* HEADER ROW */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md border",
              style.badge,
            )}
          >
            {insight.priority} Priority
          </span>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shadow-sm",
                style.iconWrapper,
              )}
            >
              <Icon size={18} />
            </div>

            {/* Expand Toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn btn-ghost btn-xs"
            >
              <ChevronDown
                size={18}
                className={cn(
                  "transition-transform duration-300",
                  expanded && "rotate-180",
                )}
              />
            </button>
          </div>
        </div>

        <h4 className="font-semibold text-base">{insight.title}</h4>

        {/* DESCRIPTION */}
        <div
          className={cn(
            "text-sm text-base-content/70 transition-all duration-300",
            !expanded && "line-clamp-3",
          )}
        >
          {insight.description}
        </div>

        <span className="text-xs opacity-50">AI generated insight</span>
      </div>
    </div>
  );
}
