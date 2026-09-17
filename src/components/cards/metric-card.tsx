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
  CalendarCheck,
  ClipboardList,
  UsersRound,
  Building2,
  Eye,
  BadgeDollarSign,
} from "lucide-react";
import {
  computePeriodDelta,
  formatPeriodDeltaLabel,
  periodDeltaIsNegative,
  periodDeltaNote,
  type PeriodDelta,
} from "@/lib/periodDelta";

const metricIcons: Record<string, React.ReactNode> = {
  totalEvents: <CalendarCheck />,
  totalRequests: <ClipboardList />,
  totalClients: <UsersRound />,
  totalDistributors: <Building2 />,
  totalConsumersSampled: <UsersRound />,
  totalPurchases: <ShoppingCart />,
  overallConversionRate: <Target />,
  totalDemos: <BarChart3 />,
  newCustomersSampled: <UserPlus />,
  boxesSold: <Boxes />,
  additionalDisplays: <Users />,
  revenueGenerated: <DollarSign />,
  totalCansSold: <ShoppingCart />,
  multiPacksSold: <Boxes />,
  singleCansSold: <ShoppingCart />,
  brandAwareness: <Eye />,
  purchaseIntent: <BadgeDollarSign />,
};

export interface MetricCardProps {
  metricKey: string;
  title: string;
  value: string;
  /** Legacy string change (prefer current + previous). */
  change?: string;
  /** Prefer these — honest % via computePeriodDelta. */
  current?: number;
  previous?: number | null;
  delta?: PeriodDelta;
  subtitle?: string;
  variant?: "success" | "error" | "neutral";
  icon?: React.ReactNode;
  comparisonLabel?: string;
}

export function MetricCard({
  metricKey,
  title,
  value,
  change,
  current,
  previous,
  delta: deltaProp,
  subtitle,
  variant = "neutral",
  icon,
  comparisonLabel = "vs previous period",
}: MetricCardProps) {
  const delta =
    deltaProp ??
    (typeof current === "number" && typeof previous === "number"
      ? computePeriodDelta(current, previous)
      : typeof current === "number" && (previous == null || previous === 0)
        ? computePeriodDelta(current, previous ?? 0)
        : null);

  const changeLabel = delta
    ? formatPeriodDeltaLabel(delta)
    : (change ?? "—");
  const note = delta ? periodDeltaNote(delta) : null;
  const isNegative = delta
    ? periodDeltaIsNegative(delta)
    : changeLabel.startsWith("-") || changeLabel.startsWith("↓");

  const tone =
    variant === "success" || (!isNegative && delta && delta.kind !== "none")
      ? "lime"
      : isNegative
        ? "orange"
        : "muted";

  const selectedIcon = metricKey
    ? (metricIcons[metricKey] ?? null)
    : (icon ?? null);

  return (
    <div
      className="spark-card hov relative px-4 py-4 lg:px-5"
      style={{ borderRadius: 16 }}
    >
      <div className="flex items-start gap-3">
        {selectedIcon ? (
          <div
            className="p-2 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background:
                tone === "lime"
                  ? "rgba(197,245,70,0.12)"
                  : tone === "orange"
                    ? "rgba(239,90,42,0.12)"
                    : "rgba(255,255,255,0.04)",
              color:
                tone === "lime"
                  ? "var(--spark-lime)"
                  : tone === "orange"
                    ? "var(--spark-orange)"
                    : "rgba(255,255,255,0.55)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <div className="w-4 h-4">{selectedIcon}</div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="label-mini">{title}</p>
          <p
            className="tab-num text-2xl lg:text-3xl font-bold leading-tight mt-1.5"
            style={{ letterSpacing: "-0.03em" }}
          >
            {value}
          </p>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {isNegative ? (
              <TrendingDown
                className="w-3.5 h-3.5"
                style={{ color: "var(--spark-orange)" }}
              />
            ) : (
              <TrendingUp
                className="w-3.5 h-3.5"
                style={{
                  color:
                    delta?.kind === "none" || delta?.kind === "sparse"
                      ? "rgba(255,255,255,0.45)"
                      : "var(--spark-lime)",
                }}
              />
            )}
            <span
              className="text-xs font-semibold mono"
              style={{
                letterSpacing: "0.04em",
                color: isNegative
                  ? "var(--spark-orange)"
                  : delta?.kind === "sparse" || delta?.kind === "none"
                    ? "rgba(255,255,255,0.55)"
                    : "var(--spark-lime)",
              }}
            >
              {changeLabel}
            </span>
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {comparisonLabel}
            </span>
            {subtitle ? (
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {subtitle}
              </span>
            ) : null}
          </div>
          {note ? (
            <p
              className="text-[11px] mt-1.5 leading-snug"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
