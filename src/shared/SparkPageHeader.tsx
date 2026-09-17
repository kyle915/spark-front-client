import type { ReactNode } from "react";

/**
 * Shared page header — title + one support line + optional primary action.
 * Replaces copy-pasted mono eyebrow / h1 / p stacks on operator pages.
 */
export function SparkPageHeader({
  title,
  support,
  eyebrow,
  action,
  className = "",
  titleClassName = "text-4xl md:text-5xl font-bold",
}: {
  title: ReactNode;
  support?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-4 ${className}`.trim()}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="label-mini mb-2">{eyebrow}</p>
        ) : null}
        <h1 className={`spark-title ${titleClassName}`.trim()}>{title}</h1>
        {support ? <p className="spark-support mt-3">{support}</p> : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>
      ) : null}
    </div>
  );
}

export default SparkPageHeader;
