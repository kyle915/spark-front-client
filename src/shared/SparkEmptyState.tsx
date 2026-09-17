import type { ReactNode } from "react";

/**
 * Centered empty card — message + optional primary CTA.
 */
export function SparkEmptyState({
  title,
  body,
  action,
  className = "",
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`spark-empty ${className}`.trim()}>
      <h2 className="spark-title text-2xl font-semibold">{title}</h2>
      {body ? <p className="spark-support mt-2 mx-auto">{body}</p> : null}
      {action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export default SparkEmptyState;
