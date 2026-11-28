import React, { useId } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { buildSparklinePath } from "./sparklineMath";

export type KpiDirection = "up" | "down" | "flat";

/**
 * Standardized compact delta pill across Executive Snapshot, Reports, and
 * Shelf & Voice KPI cards.
 */
export const KpiDeltaBadge: React.FC<{
  direction: KpiDirection;
  label: React.ReactNode;
  invertGood?: boolean;
}> = ({ direction, label, invertGood = false }) => {
  const isPositive =
    direction === "flat"
      ? null
      : invertGood
        ? direction === "down"
        : direction === "up";

  const style: React.CSSProperties =
    isPositive === true
      ? {
          background: "var(--spark-ok-bg, rgba(148, 224, 64, 0.12))",
          color: "var(--spark-ok-ink)",
          border: "1px solid var(--spark-ok-border, rgba(148, 224, 64, 0.28))",
        }
      : isPositive === false
        ? {
            background: "rgba(239, 90, 42, 0.11)",
            color: "var(--spark-flag-ink, var(--spark-orange, #ef5a2a))",
            border: "1px solid rgba(239, 90, 42, 0.28)",
          }
        : {
            background: "var(--spark-surface)",
            color: "var(--spark-text-meta)",
            border: "1px solid var(--spark-hairline, var(--spark-border))",
          };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tab-num max-w-full"
      style={style}
    >
      {direction === "up" ? (
        <TrendingUp size={10.5} strokeWidth={2.2} className="shrink-0" />
      ) : null}
      {direction === "down" ? (
        <TrendingDown size={10.5} strokeWidth={2.2} className="shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
};

/**
 * Zero-dependency inline SVG trend sparkline with area fill and terminal dot.
 */
export const MiniSparkline: React.FC<{
  points: readonly number[];
  tone?: "positive" | "negative" | "neutral";
  width?: number;
  height?: number;
}> = ({ points, tone = "neutral", width = 62, height = 22 }) => {
  const gradId = useId();
  const geom = buildSparklinePath(points, width, height);
  if (!geom.linePath) return null;

  const stroke =
    tone === "positive"
      ? "var(--spark-ok-ink, var(--spark-lime))"
      : tone === "negative"
        ? "var(--spark-orange, #ef5a2a)"
        : "var(--spark-text-meta)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={geom.areaPath} fill={`url(#${gradId})`} />
      <path
        d={geom.linePath}
        stroke={stroke}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {geom.lastPoint ? (
        <circle
          cx={geom.lastPoint.x}
          cy={geom.lastPoint.y}
          r="2.1"
          fill={stroke}
        />
      ) : null}
    </svg>
  );
};

/**
 * Matching-height hairline skeleton for KPI items and cards (zero layout shift).
 */
export const StudioKpiSkeleton: React.FC<{
  variant?: "inline" | "card";
  label?: string;
}> = ({ variant = "card", label }) => {
  if (variant === "inline") {
    return (
      <div className="min-w-0 space-y-2" aria-busy="true">
        {label ? (
          <dt
            className="text-[13px] font-medium"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            {label}
          </dt>
        ) : (
          <div className="spark-kpi-skeleton-bar h-3.5 w-24 rounded-md" />
        )}
        <dd className="m-0">
          <div className="spark-kpi-skeleton-bar h-8 w-20 rounded-lg" />
        </dd>
        <div className="spark-kpi-skeleton-bar h-4 w-28 rounded-full" />
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      className="spark-card p-5 space-y-3"
      style={{ minHeight: 146 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="spark-kpi-skeleton-bar h-3.5 w-28 rounded-md" />
        <div className="spark-kpi-skeleton-bar h-5 w-14 rounded-md" />
      </div>
      <div className="spark-kpi-skeleton-bar h-8 w-24 rounded-lg" />
      <div className="spark-kpi-skeleton-bar h-2 w-full rounded-full" />
      <div className="spark-kpi-skeleton-bar h-3.5 w-36 rounded-md" />
    </div>
  );
};
