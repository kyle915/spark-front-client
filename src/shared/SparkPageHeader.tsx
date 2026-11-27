import type { ReactNode } from "react";
import SparkInfoTip from "./SparkInfoTip";

/**
 * Shared page header — quieter Linear-ish chrome by default.
 * Title + optional ⓘ methodology tooltip + concise support line + optional primary action.
 */
export function SparkPageHeader({
  title,
  support,
  infoTip,
  eyebrow,
  action,
  className = "",
  titleClassName = "font-semibold",
}: {
  title: ReactNode;
  support?: ReactNode;
  infoTip?: string;
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
        <div className="flex items-center gap-2">
          <h1 className={`spark-title ${titleClassName}`.trim()}>{title}</h1>
          {infoTip ? <SparkInfoTip note={infoTip} /> : null}
        </div>
        {/* The one-line explanation is helpful on a desk, noise on a phone. */}
        {support ? (
          <p className="spark-support hidden sm:block">{support}</p>
        ) : null}
      </div>
      {action ? (
        // max-w-full (not shrink-0) so a long action row wraps inside the
        // page instead of running off the right edge on narrow screens.
        <div className="flex flex-wrap items-center gap-2 max-w-full">{action}</div>
      ) : null}
    </div>
  );
}

export default SparkPageHeader;
