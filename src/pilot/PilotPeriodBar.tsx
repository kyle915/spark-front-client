import React from "react";
import { PILOT_RANGE_OPTIONS, type PilotRangeKey } from "./pilotPeriodFilter";

const FIELD_STYLE: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
};

export interface PilotPeriodBarProps {
  range: PilotRangeKey;
  onRangeChange: (next: PilotRangeKey) => void;
  customStart: string;
  onCustomStartChange: (next: string) => void;
  customEnd: string;
  onCustomEndChange: (next: string) => void;
  ariaLabel?: string;
}

export const PilotPeriodBar: React.FC<PilotPeriodBarProps> = ({
  range,
  onRangeChange,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  ariaLabel = "Reporting date window",
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="pill-group" role="group" aria-label={ariaLabel}>
      {PILOT_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onRangeChange(opt.key)}
          className={`pill-btn ${range === opt.key ? "on" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
    {range === "custom" ? (
      <div className="inline-flex flex-wrap items-center gap-1.5 text-xs">
        <input
          type="date"
          aria-label="Period start date"
          value={customStart}
          onChange={(e) => onCustomStartChange(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg tab-num"
          style={FIELD_STYLE}
        />
        <span style={{ color: "var(--spark-text-meta)" }}>to</span>
        <input
          type="date"
          aria-label="Period end date"
          value={customEnd}
          onChange={(e) => onCustomEndChange(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg tab-num"
          style={FIELD_STYLE}
        />
      </div>
    ) : null}
  </div>
);

export default PilotPeriodBar;
