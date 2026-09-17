import NumberFlow from "@number-flow/react";
import type { CSSProperties } from "react";

/**
 * Animated count for live ops KPIs. Uses number-flow under the hood;
 * respects prefers-reduced-motion via NumberFlow defaults.
 */
export function CountReel({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <NumberFlow
      value={value}
      locales="en-US"
      className={`spark-ops-reel ${className ?? ""}`.trim()}
      style={style}
      transformTiming={{ duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      spinTiming={{ duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      opacityTiming={{ duration: 200, easing: "ease-out" }}
    />
  );
}
