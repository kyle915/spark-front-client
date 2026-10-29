import type { ReactNode } from "react";

/**
 * Shared page header — quieter Linear-ish chrome by default.
 * Title + one support line + optional primary action.
 */
export function SparkPageHeader({
  title,
  support,
  eyebrow,
  action,
  className = "",
  titleClassName = "font-semibold",
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
      className={`spark-page-header flex flex-wrap items-start justify-between gap-3 ${className}`.trim()}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="label-mini">{eyebrow}</p> : null}
        <h1 className={`spark-title ${titleClassName}`.trim()}>{title}</h1>
        {support ? <p className="spark-support">{support}</p> : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>
      ) : null}
    </div>
  );
}

export default SparkPageHeader;
