import { useState, type CSSProperties } from "react";
import { OdometerReadout } from "@/motion/OdometerStepper";
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
  const [pulse, setPulse] = useState<{ delta: number; seq: number } | null>(
    null,
  );
  const parsed = Number(value ?? 0);
  const numericVal =
    Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;

  const triggerStep = (delta: number) => {
    setPulse((prev) => ({ delta, seq: (prev?.seq ?? 0) + 1 }));
    onChange(stepNumericInput(value, delta));
  };

  const sizedStyle: CSSProperties = compact
    ? { ...pillStyle, minHeight: 34, minWidth: 38, padding: "3px 8px", fontSize: 12 }
    : pillStyle;

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
      <OdometerReadout value={numericVal} compact={compact} />
      {numericVal > 0 ? (
        <button
          key={pulse?.delta === -1 ? `minus-${pulse.seq}` : "minus"}
          type="button"
          onClick={() => triggerStep(-1)}
          aria-label={`Subtract 1 from ${ariaPrefix}`}
          className={pulse?.delta === -1 ? "spark-stepper-pop" : undefined}
          style={sizedStyle}
        >
          −1
        </button>
      ) : null}
      {STEPS.map((delta) => (
        <button
          key={pulse?.delta === delta ? `plus-${delta}-${pulse.seq}` : delta}
          type="button"
          onClick={() => triggerStep(delta)}
          aria-label={`Add ${delta} to ${ariaPrefix}`}
          className={pulse?.delta === delta ? "spark-stepper-pop" : undefined}
          style={sizedStyle}
        >
          +{delta}
        </button>
      ))}
    </div>
  );
}

export default QuickCountSteppers;
