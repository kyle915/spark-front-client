import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ActionPhase } from "./opsMotion";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  phase: ActionPhase;
  pendingLabel?: ReactNode;
  successLabel?: ReactNode;
};

const CheckGlyph = () => (
  <svg className="spark-ops-check" viewBox="0 0 16 16" aria-hidden>
    <path className="spark-ops-check-path" d="M3.2 8.2 6.4 11.4 12.8 4.6" />
  </svg>
);

export function ActionMorphButton({
  phase,
  pendingLabel,
  successLabel,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const label =
    phase === "pending"
      ? (pendingLabel ?? children)
      : phase === "success"
        ? (successLabel ?? children)
        : children;

  return (
    <button
      type={type}
      disabled={disabled || phase !== "idle"}
      className={`spark-ops-action ${className ?? ""}`.trim()}
      {...rest}
    >
      {phase === "pending" ? (
        <span className="spark-ops-glyph" aria-hidden>
          <span className="spark-ops-spinner" />
        </span>
      ) : phase === "success" ? (
        <span className="spark-ops-glyph" aria-hidden>
          <CheckGlyph />
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}
