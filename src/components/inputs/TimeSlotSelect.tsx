/**
 * Mobile-friendly time picker for activation scheduling.
 *
 * Replaces the native <input type="time"> clock-face picker that's
 * brutal on mobile (24-hour analog dial). Activations are scheduled
 * on the half-hour in ~95% of cases, so a flat dropdown of 30-min
 * slots covers the workflow and renders as the native scrollable
 * wheel on iOS/Android.
 *
 * State contract: stores 24-hour "HH:MM" so the backend payload and
 * existing yup/zod validation are unchanged.
 */
import React from "react";

const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) {
    const h24 = Math.floor(m / 60);
    const min = m % 60;
    const h12 = ((h24 + 11) % 12) + 1;
    const ampm = h24 < 12 ? "AM" : "PM";
    const value = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const label = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
    out.push({ value, label });
  }
  return out;
})();

type Props = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  "aria-label"?: string;
};

const TimeSlotSelect: React.FC<Props> = ({
  value,
  onChange,
  className,
  style,
  disabled,
  "aria-label": ariaLabel,
}) => {
  // If the caller passes a value that doesn't fall on our 30-min grid
  // (e.g. legacy 17:13), we still show it so we don't silently corrupt
  // the form on load — just append the live value as an out-of-grid
  // option.
  const slots = TIME_SLOTS.some((s) => s.value === value)
    ? TIME_SLOTS
    : value
      ? [{ value, label: `${value} (custom)` }, ...TIME_SLOTS]
      : TIME_SLOTS;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {slots.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
};

export default TimeSlotSelect;
export { TIME_SLOTS };
