import type { CSSProperties } from "react";
import { stepNumericInput } from "./oneHandedCheckin";

const STEPS = [1, 5, 10] as const;

const pillStyle: CSSProperties = {
  minHeight: 36,
  minWidth: 42,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid #d6d3c8",
  background: "#faf7f1",
  color: "#1c1917",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  touchAction: "manipulation",
  userSelect: "none",
};

export function QuickCountSteppers({
  value,
  onChange,
  ariaPrefix,
  compact = false,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
  ariaPrefix: string;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={`Quick count buttons for ${ariaPrefix}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 4 : 6,
        flexWrap: "wrap",
      }}
    >
      {STEPS.map((delta) => (
        <button
          key={delta}
          type="button"
          onClick={() => onChange(stepNumericInput(value, delta))}
          aria-label={`Add ${delta} to ${ariaPrefix}`}
          style={
            compact
              ? { ...pillStyle, minHeight: 34, minWidth: 38, padding: "3px 8px", fontSize: 12 }
              : pillStyle
          }
        >
          +{delta}
        </button>
      ))}
    </div>
  );
}

export default QuickCountSteppers;
