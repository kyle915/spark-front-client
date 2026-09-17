import type { ChartOptions } from "chart.js";

/** Shared Spark dark Chart.js chrome (DashWind-inspired, lime/sky ops). */
export const SPARK_CHART_PALETTE = [
  "rgba(197,245,70,0.85)",
  "rgba(56,189,248,0.85)",
  "rgba(239,90,42,0.85)",
  "rgba(168,85,247,0.85)",
  "rgba(250,204,21,0.85)",
  "rgba(255,255,255,0.45)",
];

export const sparkChartText = "rgba(255,255,255,0.72)";
export const sparkChartMuted = "rgba(255,255,255,0.45)";
export const sparkChartGrid = "rgba(255,255,255,0.06)";

export function sparkScaleDefaults() {
  return {
    ticks: { color: sparkChartMuted, font: { size: 11 } },
    grid: { color: sparkChartGrid },
    border: { color: "transparent" },
  };
}

export function sparkLegendDefaults() {
  return {
    labels: {
      color: sparkChartText,
      font: { size: 11 },
      boxWidth: 10,
      boxHeight: 10,
      usePointStyle: true,
      padding: 14,
    },
  };
}

/** Base options for bar/line/doughnut on dark ops surfaces. */
export function sparkChartOptions<T extends "bar" | "line" | "doughnut">(
  overrides?: ChartOptions<T>,
): ChartOptions<T> {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        ...sparkLegendDefaults(),
      },
      tooltip: {
        backgroundColor: "rgba(10,13,9,0.92)",
        titleColor: sparkChartText,
        bodyColor: sparkChartMuted,
        borderColor: "rgba(197,245,70,0.25)",
        borderWidth: 1,
        padding: 10,
      },
    },
  };
  return { ...base, ...(overrides ?? {}) } as ChartOptions<T>;
}
