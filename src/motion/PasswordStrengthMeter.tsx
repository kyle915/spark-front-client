import React from "react";
import { evaluatePasswordStrength } from "./passwordStrength";

/**
 * Password Strength Meter — 4-segment animated strength bar shown once typing
 * starts on signup and password-reset forms.
 */
export const PasswordStrengthMeter: React.FC<{
  password: string | null | undefined;
  className?: string;
}> = ({ password, className = "" }) => {
  const res = evaluatePasswordStrength(password);
  if (res.score === 0) return null;

  return (
    <div
      aria-live="polite"
      className={`mt-1.5 space-y-1 ${className}`.trim()}
    >
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((idx) => {
          const active = idx <= res.score;
          return (
            <span
              key={idx}
              className="spark-strength-seg h-1 rounded-full block"
              style={{
                background: active
                  ? res.color
                  : "var(--spark-border, rgba(120, 120, 120, 0.28))",
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold" style={{ color: res.color }}>
          {res.label}
        </span>
        <span className="truncate" style={{ color: "var(--spark-text-meta, #78716c)" }}>
          {res.hint}
        </span>
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
