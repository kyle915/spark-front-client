import React from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Target,
  BarChart3,
  UserPlus,
  Boxes,
  Users,
  DollarSign,
} from "lucide-react";
import { cn } from "../../lib/utils";

import {
  CalendarCheck,
  ClipboardList,
  UsersRound,
  Building2,
  Eye,
  BadgeDollarSign
} from "lucide-react";

const metricIcons: Record<string, React.ReactNode> = {
  totalEvents: <CalendarCheck />,
  totalRequests: <ClipboardList />,
  totalClients: <UsersRound />,
  totalDistributors: <Building2 />,
  consumersSampled: <UsersRound />,
  totalPurchases: <ShoppingCart className="text-green-500" />,
  overallConversionRate: <Target className="text-purple-500" />,
  totalDemos: <BarChart3 className="text-yellow-500" />,
  newCustomersSampled: <UserPlus className="text-pink-500" />,
  boxesSold: <Boxes className="text-red-500" />,
  additionalDisplays: <Users className="text-gray-500" />,
  revenueGenerated: <DollarSign className="text-green-500" />,
  brandAwareness: <Eye />,
  purchaseIntent: <BadgeDollarSign />
};

export interface MetricCardProps {
  metricKey: string;
  title: string;
  value: string;
  change: string;
  subtitle?: string;
  variant?: "success" | "error" | "neutral";
  icon?: React.ReactNode;
}

export function MetricCard({
  metricKey,
  title,
  value,
  change,
  subtitle,
  variant = "neutral",
  icon,
}: MetricCardProps) {
  const isNegative = change.startsWith("-");

  // DaisyUI-driven color scheme
  const colorScheme =
    variant === "success"
      ? {
        text: "text-green-600",
        bg: "bg-green-600/10",
      }
      : variant === "error"
        ? {
          text: "text-error",
          bg: "bg-error/10",
        }
        : {
          text: "text-neutral-content",
          bg: "bg-base-300/40",
        };

  const selectedIcon = metricKey
    ? metricIcons[metricKey] ?? null
    : icon ?? null;

  return (
    <div
      className={cn(
        // Card container
        "rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300",
        "bg-base-100 text-base-content border border-base-300",
        "dark:border-base-700 dark:bg-base backdrop-blur-sm"
      )}
    >
      {/* TITLE */}
      <p className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
        {title}
      </p>

      {/* VALUE + ICON */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-4xl font-bold leading-tight">{value}</p>

        <div
          className={cn(
            "p-3 rounded-xl flex items-center justify-center",
            "transition-colors duration-300",
            colorScheme.bg
          )}
        >
          <div className={cn("w-6 h-6", colorScheme.text)}>{selectedIcon}</div>
        </div>
      </div>

      {/* FOOTER — Trends */}
      <div className="flex items-center gap-2 mt-4">
        {isNegative ? (
          <TrendingDown className={cn("w-5 h-5", colorScheme.text)} />
        ) : (
          <TrendingUp className={cn("w-5 h-5", colorScheme.text)} />
        )}

        <span
          className={cn(
            "text-sm font-semibold",
            isNegative ? "text-error" : "text-green-600"
          )}
        >
          {change}
        </span>
        <span
          className={cn(
            "text-sm",
          )}
        >
          vs Q4 2024
        </span>

        {subtitle && (
          <span className="text-sm text-base-content/60">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
