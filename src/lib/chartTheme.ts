import type { ChartOptions } from "chart.js";
import { accentRgba, inkRgba } from "@/theme/chartInk";

/** Shared Spark dark Chart.js chrome — off-white / sky / orange, no lime. */
export const SPARK_CHART_PALETTE = [
  accentRgba(0.75),
  "rgba(95,184,239,0.85)",
  "rgba(239,90,42,0.85)",
  "rgba(168,85,247,0.75)",
  inkRgba(0.35),
  inkRgba(0.22),
];

export const sparkChartText = inkRgba(0.72);
export const sparkChartMuted = inkRgba(0.55);
export const sparkChartGrid = inkRgba(0.08);

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

export function sparkTooltipDefaults() {
  return {
    // The tooltip is a dark chip in both appearances.
    backgroundColor: "rgba(10,11,13,0.92)",
    titleColor: "rgba(255,255,255,0.9)",
    bodyColor: "rgba(255,255,255,0.7)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    padding: 10,
  };
}

type ScaleChrome = {
  ticks?: object;
  grid?: object;
  border?: object;
  title?: object;
};

/** Quiet tick, grid, and axis-title chrome layered under a chart's own scale. */
function withSparkScale<S>(scale: S): S {
  if (!scale || typeof scale !== "object") return scale;
  const axis = scale as S & ScaleChrome;
  const defaults = sparkScaleDefaults();
  return {
    ...axis,
    ticks: { ...defaults.ticks, ...axis.ticks },
    grid: { ...defaults.grid, ...axis.grid },
    border: { ...defaults.border, ...axis.border },
    ...(axis.title
      ? {
          title: {
            color: sparkChartText,
            font: { size: 11 },
            ...axis.title,
          },
        }
      : {}),
  };
}

/**
 * Dark-ops Chart.js options. Legend, tooltip, and scale chrome come from
 * this module and deep-merge under caller overrides (dual axes, titles,
 * tick callbacks) so charts do not restate grid, legend, or tooltip colors.
 */
export function sparkChartOptions<T extends "bar" | "line" | "doughnut">(
  overrides?: ChartOptions<T>,
): ChartOptions<T> {
  const { plugins: pluginOverrides, scales, ...rest } = overrides ?? {};
  const legendOverride =
    pluginOverrides?.legend && typeof pluginOverrides.legend === "object"
      ? pluginOverrides.legend
      : undefined;
  const tooltipOverride =
    pluginOverrides?.tooltip && typeof pluginOverrides.tooltip === "object"
      ? pluginOverrides.tooltip
      : undefined;
  const legendLabels =
    legendOverride && "labels" in legendOverride && legendOverride.labels
      ? legendOverride.labels
      : undefined;

  const mergedScales = scales
    ? Object.fromEntries(
        Object.entries(scales).map(([key, scale]) => [key, withSparkScale(scale)]),
      )
    : undefined;

  return {
    responsive: true,
    maintainAspectRatio: false,
    ...rest,
    plugins: {
      ...pluginOverrides,
      legend: {
        display: true,
        position: "top" as const,
        ...sparkLegendDefaults(),
        ...legendOverride,
        labels: {
          ...sparkLegendDefaults().labels,
          ...(legendLabels && typeof legendLabels === "object" ? legendLabels : {}),
        },
      },
      tooltip: {
        ...sparkTooltipDefaults(),
        ...tooltipOverride,
      },
    },
    ...(mergedScales ? { scales: mergedScales } : {}),
  } as ChartOptions<T>;
}
