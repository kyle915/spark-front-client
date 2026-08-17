/**
 * Real Spark product mark — same PNG the sidebar and login use.
 * Source file is black on transparent. Recaps are white, so do not invert.
 * Pass `onDark` only for dark chrome (login).
 */
export function SparkMark({
  height = 22,
  className,
  onDark = false,
}: {
  height?: number;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <img
      src="/legal/spark-logo.png"
      alt="Spark by Ignite"
      className={className}
      style={{
        height,
        width: "auto",
        display: "block",
        filter: onDark ? "invert(1) hue-rotate(180deg)" : undefined,
      }}
    />
  );
}
