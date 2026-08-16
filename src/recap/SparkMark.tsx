/**
 * Real Spark product mark — same PNG the sidebar and login use.
 * Source file is black on transparent; invert it for dark recap chrome.
 */
export function SparkMark({
  height = 22,
  className,
}: {
  height?: number;
  className?: string;
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
        filter: "invert(1) hue-rotate(180deg)",
      }}
    />
  );
}
