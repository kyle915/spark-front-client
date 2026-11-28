import React, { useEffect, useRef, useState } from "react";

/**
 * Odometer Readout — compact rolling tabular counter badge for BA field
 * steppers. Plays a crisp vertical roll in the direction of change.
 */
export const OdometerReadout: React.FC<{
  value: number;
  compact?: boolean;
}> = ({ value, compact = false }) => {
  const prevRef = useRef(value);
  const [roll, setRoll] = useState<{ key: number; dir: "up" | "down" | "idle" }>({
    key: 0,
    dir: "idle",
  });

  useEffect(() => {
    if (value !== prevRef.current) {
      const dir = value > prevRef.current ? "up" : "down";
      prevRef.current = value;
      setRoll((r) => ({ key: r.key + 1, dir }));
    }
  }, [value]);

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: compact ? 34 : 36,
        minWidth: compact ? 38 : 44,
        padding: compact ? "3px 8px" : "4px 10px",
        borderRadius: 999,
        background: value > 0 ? "#14160f" : "rgba(20, 22, 15, 0.06)",
        color: value > 0 ? "#ffffff" : "#57534e",
        fontSize: compact ? 12 : 13,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        overflow: "hidden",
      }}
    >
      <span
        key={roll.key}
        className={
          roll.dir === "up"
            ? "spark-odo-up"
            : roll.dir === "down"
              ? "spark-odo-down"
              : undefined
        }
      >
        {value.toLocaleString("en-US")}
      </span>
    </span>
  );
};
