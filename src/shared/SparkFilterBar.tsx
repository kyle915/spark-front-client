import type { ReactNode } from "react";

/**
 * Consistent filter chrome — search slot + chips/controls with shared spacing.
 */
export function SparkFilterBar({
  label,
  search,
  children,
  trailing,
  className = "",
}: {
  label?: ReactNode;
  search?: ReactNode;
  children?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`spark-filter-bar ${className}`.trim()}>
      {label ? <span className="label-mini mr-1">{label}</span> : null}
      {search}
      {children}
      {trailing ? <span className="flex-1 min-w-[0.5rem]" /> : null}
      {trailing}
    </div>
  );
}

export default SparkFilterBar;
