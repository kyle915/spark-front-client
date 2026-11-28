import React from "react";
import { StrokeCheckBadge } from "./ProgressMoments";
import { resolveTideTone } from "./tideHelpers";

/**
 * Tide Progress — smooth quota/completion meter with animated wave crest and
 * automatic healthy -> near-cap -> at-cap color transition.
 */
export const TideProgress: React.FC<{
  percent: number;
  barColor?: string;
  height?: number;
  showPercentBadge?: boolean;
  ariaLabel?: string;
}> = ({
  percent,
  barColor,
  height = 12,
  showPercentBadge = false,
  ariaLabel = "Usage progress",
}) => {
  const clamped = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, Math.round(percent)))
    : 0;
  const tone = resolveTideTone(clamped, barColor);

  return (
    <div className="space-y-1.5">
      {showPercentBadge ? (
        <div className="flex items-center justify-between text-[11px] mono">
          <span
            className="px-2 py-0.5 rounded-full font-semibold"
            style={{ background: tone.badgeBg, color: tone.badgeFg }}
          >
            {tone.statusText}
          </span>
          <span className="tab-num font-semibold" style={{ color: "var(--spark-text-meta)" }}>
            {clamped}% utilized
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full rounded-full overflow-hidden"
        style={{
          height,
          background: "var(--pilot-meter-track, var(--spark-surface-2))",
        }}
      >
        <div
          className="spark-tide-fill h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: tone.fill,
          }}
        >
          {clamped > 0 && clamped < 100 ? (
            <span className="spark-tide-crest" aria-hidden />
          ) : null}
        </div>
      </div>
    </div>
  );
};

/**
 * Plan Picker Card — tactile Studio selection card with animated border glow
 * and StrokeCheckBadge for plan tiers and starter activation templates.
 */
export const PlanPickerCard: React.FC<{
  selected: boolean;
  onSelect?: () => void;
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  compact?: boolean;
  className?: string;
}> = ({
  selected,
  onSelect,
  title,
  badge,
  subtitle,
  children,
  footer,
  compact = false,
  className = "",
}) => {
  const interactive = typeof onSelect === "function";

  return (
    <div
      data-selected={selected ? "true" : "false"}
      onClick={onSelect}
      role={interactive ? "radio" : undefined}
      aria-checked={interactive ? selected : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={`spark-plan-card rounded-xl ${compact ? "p-3.5" : "p-5"} flex flex-col justify-between ${interactive ? "cursor-pointer select-none" : ""} ${className}`.trim()}
      style={{
        border: selected
          ? "1.5px solid var(--pilot-ok-border, var(--spark-lime))"
          : "1px solid var(--spark-border)",
        background: selected
          ? "var(--pilot-ok-subtle, rgba(var(--spark-accent-rgb, 148, 224, 64), 0.06))"
          : compact
            ? "var(--spark-surface-2)"
            : "var(--spark-surface)",
      }}
    >
      <div className={compact ? "space-y-1" : "space-y-3"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={compact ? "text-sm font-semibold" : "display text-lg font-bold"}>
                {title}
              </span>
              {badge}
            </div>
            {subtitle ? (
              <div className="text-xs mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
                {subtitle}
              </div>
            ) : null}
          </div>
          <StrokeCheckBadge
            done={selected}
            accent="var(--pilot-ok-border, var(--spark-lime))"
            size={compact ? 19 : 21}
          />
        </div>
        {children}
      </div>
      {footer ? <div className="pt-3">{footer}</div> : null}
    </div>
  );
};
