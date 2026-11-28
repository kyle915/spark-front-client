import React, { useEffect, useRef, useState } from "react";

/**
 * Shared transient "just completed" tracker: turns true briefly (default 1.6s)
 * right after a busy operation finishes, unless `failed` is signaled.
 */
function useCompletionPulse(busy: boolean, holdMs = 1600): boolean {
  const wasBusy = useRef(busy);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      setDone(true);
      const t = window.setTimeout(() => setDone(false), holdMs);
      wasBusy.current = busy;
      return () => window.clearTimeout(t);
    }
    wasBusy.current = busy;
  }, [busy, holdMs]);

  return done;
}

/**
 * Download Ring — SVG download glyph that morphs into an animated circular
 * progress ring while building a PDF and draws a crisp checkmark on finish.
 */
export interface DownloadRingButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  busy: boolean;
  idleLabel: React.ReactNode;
  busyLabel?: React.ReactNode;
  doneLabel?: React.ReactNode;
  /** Optional explicit counter incremented only on successful download. */
  successCount?: number;
}

export const DownloadRingButton: React.FC<DownloadRingButtonProps> = ({
  busy,
  idleLabel,
  busyLabel = "Building PDF…",
  doneLabel = "Downloaded",
  successCount,
  disabled,
  className = "",
  ...rest
}) => {
  const autoDone = useCompletionPulse(busy);
  const [explicitDone, setExplicitDone] = useState(false);
  const prevCount = useRef(successCount ?? 0);

  useEffect(() => {
    if (successCount != null && successCount > prevCount.current) {
      prevCount.current = successCount;
      setExplicitDone(true);
      const t = window.setTimeout(() => setExplicitDone(false), 1800);
      return () => window.clearTimeout(t);
    }
    if (successCount != null) prevCount.current = successCount;
  }, [successCount]);

  const showDone = !busy && (successCount != null ? explicitDone : autoDone);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 ${className}`.trim()}
      {...rest}
    >
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        {busy ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="38"
              className="spark-download-ring-arc"
            />
          </svg>
        ) : showDone ? (
          <svg width="14" height="14" viewBox="0 0 16 16" className="spark-ops-check">
            <path className="spark-ops-check-path" d="M3.2 8.2 6.4 11.4 12.8 4.6" />
          </svg>
        ) : (
          <svg
            width="13.5"
            height="13.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
        )}
      </span>
      <span>{busy ? busyLabel : showDone ? doneLabel : idleLabel}</span>
    </button>
  );
};

/**
 * Paper Plane Send — SVG paper plane that launches up-right while sending and
 * draws a checkmark upon completion. Supports both labeled and icon-only forms.
 */
export interface PaperPlaneSendButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  busy: boolean;
  label?: React.ReactNode;
  busyLabel?: React.ReactNode;
  doneLabel?: React.ReactNode;
  iconOnly?: boolean;
  /** Optional explicit counter incremented on successful send. */
  successCount?: number;
}

export const PaperPlaneSendButton: React.FC<PaperPlaneSendButtonProps> = ({
  busy,
  label = "Send now",
  busyLabel = "Sending…",
  doneLabel = "Sent",
  iconOnly = false,
  successCount,
  disabled,
  className = "",
  type = "button",
  ...rest
}) => {
  const [explicitDone, setExplicitDone] = useState(false);
  const prevCount = useRef(successCount ?? 0);

  useEffect(() => {
    if (successCount != null && successCount > prevCount.current) {
      prevCount.current = successCount;
      setExplicitDone(true);
      const t = window.setTimeout(() => setExplicitDone(false), 1800);
      return () => window.clearTimeout(t);
    }
    if (successCount != null) prevCount.current = successCount;
  }, [successCount]);

  const showDone = !busy && explicitDone;

  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 overflow-hidden ${className}`.trim()}
      {...rest}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center ${busy ? "spark-plane-launching" : ""}`}
        aria-hidden
      >
        {showDone ? (
          <svg width="13.5" height="13.5" viewBox="0 0 16 16" className="spark-ops-check">
            <path className="spark-ops-check-path" d="M3.2 8.2 6.4 11.4 12.8 4.6" />
          </svg>
        ) : (
          <svg
            width={iconOnly ? "14" : "13"}
            height={iconOnly ? "14" : "13"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4Z" />
          </svg>
        )}
      </span>
      {!iconOnly ? (
        <span>{busy ? busyLabel : showDone ? doneLabel : label}</span>
      ) : null}
    </button>
  );
};
