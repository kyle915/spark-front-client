import type { ReactNode } from "react";

/**
 * Centered empty card — message + optional primary CTA.
 */
export function SparkEmptyState({
  title,
  body,
  action,
  className = "",
  done = false,
}: {
  /** The list is empty because the work is finished: draws a check once. */
  done?: boolean;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
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
      {action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export default SparkEmptyState;
