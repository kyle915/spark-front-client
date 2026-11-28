import type { ReactNode } from "react";

export interface SparkEmptyPreset {
  label: string;
  description?: string;
  onClick: () => void;
}

/**
 * Centered empty card — message + optional 1-click starter presets + primary CTA.
 */
export function SparkEmptyState({
  title,
  body,
  action,
  presets,
  className = "",
  done = false,
}: {
  /** The list is empty because the work is finished: draws a check once. */
  done?: boolean;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  presets?: readonly SparkEmptyPreset[];
  className?: string;
}) {
  return (
    <div className={`spark-empty ${className}`.trim()}>
      {done ? (
        <svg
          className="spark-done-mark mx-auto mb-4"
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden
        >
          <circle cx="22" cy="22" r="20" />
          <path d="M13 22.5l6 6 12-13" />
        </svg>
      ) : null}
      <h2 className="spark-title text-2xl font-semibold">{title}</h2>
      {body ? <p className="spark-support mt-2 mx-auto">{body}</p> : null}
      {presets && presets.length > 0 ? (
        <div
          aria-label="Starter templates"
          className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-3xl mx-auto text-left"
        >
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={preset.onClick}
              className="rounded-xl p-3.5 text-left cursor-pointer transition hover:opacity-95"
              style={{
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{preset.label}</span>
                <span
                  className="mono text-[10px] shrink-0 px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(var(--spark-accent-rgb), 0.14)",
                    color: "var(--spark-text)",
                  }}
                >
                  + Start
                </span>
              </div>
              {preset.description ? (
                <p
                  className="text-[11.5px] mt-1 leading-snug"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {preset.description}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export default SparkEmptyState;
