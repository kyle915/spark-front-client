import React, { useEffect, useRef, useState } from "react";
import { BellOff, BellRing } from "lucide-react";

/**
 * Ink Switch — tactile Studio toggle switch replacing raw native checkboxes.
 * Zero extra dependencies; respects prefers-reduced-motion via opsMotion.css.
 */
export interface InkSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  ariaLabel?: string;
  size?: "sm" | "md";
  title?: string;
  className?: string;
}

export const InkSwitch: React.FC<InkSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  size = "sm",
  title,
  className = "",
}) => {
  const trackW = size === "md" ? 38 : 32;
  const trackH = size === "md" ? 22 : 18;
  const thumb = size === "md" ? 16 : 12;
  const travel = trackW - thumb - 6;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      title={title}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`inline-flex items-center gap-2 text-left select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
      style={{ background: "transparent", border: "none", padding: 0 }}
    >
      <span
        className="spark-ink-switch"
        data-checked={checked ? "true" : "false"}
        style={{ width: trackW, height: trackH }}
        aria-hidden="true"
      >
        <span
          className="spark-ink-switch-thumb"
          style={{
            width: thumb,
            height: thumb,
            transform: checked ? `translateX(${travel}px)` : "translateX(0px)",
          }}
        />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
};

/**
 * Bell Toggle — animated bell switch for alert subscriptions (active vs paused).
 * Plays a crisp chime swing when toggled active.
 */
export interface BellToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  activeLabel?: string;
  pausedLabel?: string;
  title?: string;
}

export const BellToggle: React.FC<BellToggleProps> = ({
  active,
  onToggle,
  disabled = false,
  activeLabel = "Active",
  pausedLabel = "Paused",
  title = "Click to pause or resume alert",
}) => {
  const prevActive = useRef(active);
  const [ringKey, setRingKey] = useState(0);

  useEffect(() => {
    if (active && !prevActive.current) {
      setRingKey((k) => k + 1);
    }
    prevActive.current = active;
  }, [active]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onToggle}
      title={title}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold cursor-pointer transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
      style={{
        background: active ? "var(--spark-ok-bg)" : "var(--spark-surface)",
        color: active ? "var(--spark-ok-ink)" : "var(--spark-text-meta)",
        border: active
          ? "1px solid var(--spark-ok-border)"
          : "1px solid var(--spark-border)",
      }}
    >
      {active ? (
        <span key={ringKey} className={ringKey > 0 ? "spark-bell-ring inline-flex" : "inline-flex"}>
          <BellRing size={11} strokeWidth={2.1} aria-hidden />
        </span>
      ) : (
        <BellOff size={11} strokeWidth={2} aria-hidden />
      )}
      <span>{active ? activeLabel : pausedLabel}</span>
    </button>
  );
};
