import type { ReactNode } from "react";

/**
 * One small titled chart. Two measures on different scales are drawn as two
 * of these, one above the other on the same category axis, so the short
 * title is what tells them apart.
 */
export default function ChartBlock({
  title,
  height,
  children,
}: {
  title: string;
  /** Height of the plot in px. Chart.js needs a sized, positioned box. */
  height: number;
  children: ReactNode;
}) {
  return (
    <figure className="m-0">
      <figcaption
        className="mb-1 text-[13px] font-medium"
        style={{ color: "var(--spark-text-secondary)" }}
      >
        {title}
      </figcaption>
      <div className="relative w-full" style={{ height }}>
        {children}
      </div>
    </figure>
  );
}
