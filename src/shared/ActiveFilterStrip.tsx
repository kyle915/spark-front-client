import React from "react";
import { X } from "lucide-react";

export interface ActiveFilterChipItem {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * BoardUI-style Active Filter Summary Strip — surfaces hidden/secondary filters
 * right beneath sticky table/card toolbars with 1-click removal + Reset all.
 */
export const ActiveFilterStrip: React.FC<{
  chips: readonly ActiveFilterChipItem[];
  onResetAll: () => void;
  className?: string;
}> = ({ chips, onResetAll, className = "" }) => {
  if (chips.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Active filters"
      className={`flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl text-xs ${className}`.trim()}
      style={{
        background: "var(--spark-surface)",
        border: "1px solid var(--spark-hairline, var(--spark-border))",
      }}
    >
      <span
        className="mono text-[10px] uppercase tracking-wider mr-1"
        style={{ color: "var(--spark-text-meta)" }}
      >
        Filtered by
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          title={`Remove filter: ${chip.label}`}
          className="spark-chip-pill inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium transition hover:opacity-85 cursor-pointer"
          style={{
            background: "var(--spark-surface-2)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <span>{chip.label}</span>
          <X size={11} strokeWidth={2.1} style={{ color: "var(--spark-text-meta)" }} />
        </button>
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="ml-auto text-xs font-semibold underline underline-offset-2 transition hover:opacity-80 cursor-pointer"
        style={{
          color: "var(--spark-text-secondary)",
          background: "transparent",
          border: "none",
          padding: "0 4px",
        }}
      >
        Reset all
      </button>
    </div>
  );
};

export default ActiveFilterStrip;
