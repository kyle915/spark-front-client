import type { CSSProperties } from "react";
import {
  sanitizeSpendAmountInput,
  spendAmountError,
} from "./spendAmount";

/**
 * Dollar input shared by walk-up recap fields and ops recap editors.
 * The $ is a prefix only — the value callback receives digits and at
 * most one decimal, never a "$" string.
 */
export function SpendAmountInput({
  value,
  onChange,
  inputClassName,
  inputStyle,
  ariaLabel,
  hint = true,
}: {
  value: string;
  onChange: (next: string) => void;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  ariaLabel?: string;
  /** Walk-up shows the example under the field. Tight ops rows can hide it. */
  hint?: boolean;
}) {
  const shown = sanitizeSpendAmountInput(value);
  const err = spendAmountError(shown);
  const marginTop = inputStyle?.marginTop;
  return (
    <div>
      <div style={{ position: "relative", marginTop }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            opacity: 0.55,
            fontWeight: 600,
          }}
        >
          $
        </span>
        <input
          className={inputClassName}
          style={{
            ...inputStyle,
            marginTop: 0,
            paddingLeft: 26,
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-label={ariaLabel}
          value={shown}
          onChange={(e) => onChange(sanitizeSpendAmountInput(e.target.value))}
        />
      </div>
      {err ? (
        <p style={{ color: "#EF5A2A", fontSize: 12, margin: "6px 0 0" }}>{err}</p>
      ) : hint ? (
        <p style={{ fontSize: 12, opacity: 0.55, margin: "6px 0 0" }}>
          Dollars and cents, like 24.89
        </p>
      ) : null}
    </div>
  );
}
