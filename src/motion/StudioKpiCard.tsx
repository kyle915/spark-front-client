import React, { useId } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { buildSparklinePath, splitDeltaLabel } from "./sparklineMath";

export type KpiDirection = "up" | "down" | "flat";

/**
 * High-contrast, zero-truncation KPI delta badge across Client Home,
 * Executive Snapshot, Reports, and Shelf & Voice KPI cards.
 */
export const KpiDeltaBadge: React.FC<{
  direction: KpiDirection;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  invertGood?: boolean;
}> = ({ direction, label, sublabel, invertGood = false }) => {
  const isPositive =
    direction === "flat"
      ? null
      : invertGood
        ? direction === "down"
        : direction === "up";

  const style: React.CSSProperties =
    isPositive === true
      ? {
          background: "var(--spark-ok-bg, rgba(148, 224, 64, 0.15))",
          color: "var(--spark-ok-ink)",
          border: "1px solid var(--spark-ok-border, rgba(148, 224, 64, 0.34))",
        }
      : isPositive === false
        ? {
            background: "rgba(210, 72, 27, 0.13)",
            color: "var(--spark-flag-ink, var(--spark-orange, #ef5a2a))",
            border: "1px solid rgba(210, 72, 27, 0.34)",
          }
        : {
            background: "var(--spark-surface)",
            color: "var(--spark-text-secondary)",
            border: "1px solid var(--spark-hairline, var(--spark-border))",
          };

  const parsed =
    typeof label === "string" && sublabel === undefined
      ? splitDeltaLabel(label)
      : null;

  const badgeContent = parsed ? parsed.figure : label;
  const trailingContext =
    sublabel !== undefined ? sublabel : (parsed?.context ?? null);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 max-w-full">
      <span
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold tab-num whitespace-nowrap"
        style={style}
      >
        {direction === "up" ? (
          <TrendingUp size={11.5} strokeWidth={2.3} className="shrink-0" />
        ) : null}
        {direction === "down" ? (
          <TrendingDown size={11.5} strokeWidth={2.3} className="shrink-0" />
        ) : null}
        <span>{badgeContent}</span>
      </span>
      {trailingContext ? (
        <span
          className="text-xs font-medium tab-num whitespace-nowrap"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {trailingContext}
        </span>
      ) : null}
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
      <div
        className="min-w-0 space-y-2 py-0.5"
        aria-busy="true"
        aria-label={label ? `Loading ${label}` : "Loading metric"}
      >
        <div
          className="h-3.5 w-28 rounded animate-pulse"
          style={{ background: "var(--spark-surface-2)" }}
        />
        <div
          className="h-8 w-24 rounded-md animate-pulse"
          style={{ background: "var(--spark-surface-2)" }}
        />
        <div
          className="h-4 w-32 rounded-full animate-pulse"
          style={{ background: "var(--spark-surface-2)" }}
        />
      </div>
    );
  }
  return (
    <div
      className="spark-card p-5 space-y-2.5"
      aria-busy="true"
      aria-label={label ? `Loading ${label}` : "Loading metric card"}
    >
      <div
        className="h-3.5 w-32 rounded animate-pulse"
        style={{ background: "var(--spark-surface-2)" }}
      />
      <div
        className="h-8 w-24 rounded-md animate-pulse"
        style={{ background: "var(--spark-surface-2)" }}
      />
      <div
        className="h-4 w-28 rounded-full animate-pulse"
        style={{ background: "var(--spark-surface-2)" }}
      />
    </div>
  );
};
