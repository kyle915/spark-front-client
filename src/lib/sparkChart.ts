import type { Chart, ChartDataset, ChartOptions, Plugin } from "chart.js";
import { inkRgba } from "@/theme/chartInk";
import { readAppearance } from "@/theme/appearance";

/**
 * The one chart style for Spark.
 *
 * Most Spark charts tell one story (consumers sampled over time, top stores),
 * so the default is a single ink colour with the accent saved for the one
 * mark that matters. Colour is added only when several series must be told
 * apart, and then from a short fixed list that has been checked for
 * colour-blind separation and contrast in both appearances.
 *
 * Rules every chart built here follows:
 * - one y-scale per chart (two measures on different scales are two charts)
 * - thin bars (24px at most) with a rounded data end, 2px lines
 * - solid hairline gridlines, no axis line, labels in text colours
 * - no legend for a single series: the title says what it is
 * - orange is never a series colour; it means "needs someone"
 */

const light = (): boolean => readAppearance() === "light";

/** The single-series colour: ink in light mode, off-white in dark. */
export const chartInk = (): string => (light() ? "#14160f" : "#f2f3ee");

/** Context marks: the bars that are not the point, last period's line. */
export const chartQuiet = (): string => inkRgba(light() ? 0.22 : 0.28);

/** Text on a chart. Never the series colour. */
export const chartText = (): string => inkRgba(0.78);
export const chartTextMuted = (): string => inkRgba(0.6);
export const chartGrid = (): string => inkRgba(light() ? 0.08 : 0.1);

/** The card a chart sits on, for the 2px gap between touching marks. */
export const chartSurface = (): string => (light() ? "#ffffff" : "#141416");

/**
 * Series colours, in a fixed order, for when 2 to 4 series must be told
 * apart. Blue, yellow, violet, aqua: validated with the dataviz skill's
 * `validate_palette.js` (adjacent pairs, light on #ffffff and dark on
 * #141416): colour-blind separation >= 17 in both, normal-vision >= 24.
 * Yellow and aqua sit under 3:1 on white, so a multi-series chart always
 * carries a legend and a tooltip. Colour follows the series, never its rank.
 */
const SERIES_LIGHT = ["#2a78d6", "#eda100", "#6250d6", "#1baf7a"] as const;
const SERIES_DARK = ["#3987e5", "#c98500", "#9085e9", "#199e70"] as const;
export const MAX_SERIES = SERIES_LIGHT.length;

export const seriesColor = (index: number): string => {
  const list = light() ? SERIES_LIGHT : SERIES_DARK;
  // A fifth series is never a generated colour: the caller folds the tail
  // into "Other" (see foldToOther). Anything past the list is drawn quiet.
  return index >= 0 && index < list.length ? list[index] : chartQuiet();
};

/** "1,284" under ten thousand, "12.9K" / "4.2M" above. */
export const compactNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs < 10_000) return Math.round(value).toLocaleString("en-US");
  const units: Array<[number, string]> = [
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const scaled = value / size;
      const text = Math.abs(scaled) >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
      return `${text.replace(/\.0$/, "")}${suffix}`;
    }
  }
  return String(value);
};

/** A percent as people read it: "12.5%", "40%". For rates, never counts. */
export const percentLabel = (value: number): string =>
  Number.isFinite(value) ? `${Number(value.toFixed(1))}%` : "";

/** Keep the largest `keep` rows and fold the rest into one "Other" row. */
export function foldToOther<T extends { label: string; value: number }>(
  rows: readonly T[],
  keep: number,
): Array<{ label: string; value: number }> {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= keep) return sorted.map(({ label, value }) => ({ label, value }));
  const head = sorted.slice(0, keep).map(({ label, value }) => ({ label, value }));
  const rest = sorted.slice(keep).reduce((sum, row) => sum + row.value, 0);
  return rest > 0 ? [...head, { label: "Other", value: rest }] : head;
}

/** Which bar to draw in full ink when none is named: the largest. */
export const peakIndex = (values: readonly number[]): number => {
  let best = -1;
  values.forEach((v, i) => {
    if (Number.isFinite(v) && (best < 0 || v > values[best])) best = i;
  });
  return best;
};

type BarOpts = {
  label: string;
  data: number[];
  /** Index drawn in full ink; the rest are quiet. Omit to ink every bar. */
  emphasis?: number;
  /** Fixed colour for one of several series (see seriesColor). */
  color?: string;
  horizontal?: boolean;
};

/** One series of thin bars with a rounded data end. */
export function barSeries({
  label,
  data,
  emphasis,
  color,
  horizontal = false,
}: BarOpts): ChartDataset<"bar", number[]> {
  const ink = color ?? chartInk();
  return {
    label,
    data,
    backgroundColor:
      emphasis === undefined ? ink : data.map((_, i) => (i === emphasis ? ink : chartQuiet())),
    borderWidth: 0,
    maxBarThickness: 24,
    // Rounded at the value, square where it meets the baseline.
    borderRadius: 4,
    borderSkipped: horizontal ? "left" : "bottom",
    categoryPercentage: 0.72,
    barPercentage: 0.9,
  };
}

type LineOpts = {
  label: string;
  data: Array<number | null>;
  color?: string;
  /** A faint wash under a single series. Never for several. */
  area?: boolean;
  /** The comparison line: last period, a target. Drawn quiet. */
  quiet?: boolean;
};

/** A 2px line with a marker only on its last point. */
export function lineSeries({
  label,
  data,
  color,
  area = false,
  quiet = false,
}: LineOpts): ChartDataset<"line", Array<number | null>> {
  const stroke = quiet ? chartQuiet() : (color ?? chartInk());
  const last = data.reduce<number>((idx, v, i) => (v == null ? idx : i), -1);
  return {
    label,
    data,
    borderColor: stroke,
    borderWidth: 2,
    borderJoinStyle: "round",
    borderCapStyle: "round",
    tension: 0.25,
    fill: area && !quiet ? "origin" : false,
    backgroundColor: area && !quiet ? inkRgba(light() ? 0.06 : 0.1) : stroke,
    pointRadius: data.map((_, i) => (i === last && !quiet ? 4 : 0)),
    pointHoverRadius: 5,
    pointBackgroundColor: stroke,
    // A ring in the card colour keeps the end dot clear of the line.
    pointBorderColor: chartSurface(),
    pointBorderWidth: 2,
    spanGaps: true,
  };
}

type OptionOpts = {
  horizontal?: boolean;
  /** How axis ticks and tooltips print a value. Default compactNumber. */
  format?: (value: number) => string;
  /** Show a legend. Only for two or more series. */
  legend?: boolean;
  /** Start the value axis at zero. Bars always do. */
  beginAtZero?: boolean;
  /** Stack series on the value axis. */
  stacked?: boolean;
};

/** Axes, grid, tooltip and legend for a bar or line chart. */
export function chartOptions<T extends "bar" | "line">({
  horizontal = false,
  format = compactNumber,
  legend = false,
  beginAtZero = true,
  stacked = false,
}: OptionOpts = {}): ChartOptions<T> {
  const tick = { color: chartTextMuted(), font: { size: 12 }, padding: 8 };
  const valueAxis = {
    beginAtZero,
    stacked,
    border: { display: false },
    grid: { color: chartGrid(), lineWidth: 1, drawTicks: false },
    ticks: {
      ...tick,
      maxTicksLimit: 5,
      callback: (v: string | number) => format(Number(v)),
    },
  };
  const categoryAxis = {
    stacked,
    border: { display: false },
    grid: { display: false },
    ticks: { ...tick, color: chartText(), maxRotation: 0, autoSkipPadding: 16 },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    animation: { duration: 250 },
    interaction: { mode: horizontal ? "nearest" : "index", intersect: false, axis: horizontal ? "y" : "x" },
    layout: { padding: { top: 20, right: horizontal ? 44 : 8 } },
    scales: horizontal
      ? { x: valueAxis, y: categoryAxis }
      : { x: categoryAxis, y: valueAxis },
    plugins: {
      legend: {
        display: legend,
        position: "top",
        align: "start",
        labels: {
          color: chartText(),
          font: { size: 12 },
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "#14160f",
        titleColor: "rgba(242,243,238,0.72)",
        bodyColor: "#f2f3ee",
        titleFont: { size: 12, weight: "normal" },
        bodyFont: { size: 13, weight: "bold" },
        padding: 10,
        cornerRadius: 8,
        displayColors: legend,
        boxWidth: 8,
        boxHeight: 8,
        usePointStyle: true,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { x: number; y: number } }) => {
            const value = horizontal ? ctx.parsed.x : ctx.parsed.y;
            const name = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
            return `${legend ? name : ""}${format(value)}`;
          },
        },
      },
    },
  } as unknown as ChartOptions<T>;
}

/** Which points get a printed value: never one on every point. */
export function labelledPoints(
  values: ReadonlyArray<number | null>,
  mode: "last" | "peak" | "all",
): number[] {
  const real = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => typeof p.v === "number" && Number.isFinite(p.v));
  if (real.length === 0) return [];
  if (mode === "all") return real.map((p) => p.i);
  if (mode === "last") return [real[real.length - 1].i];
  return [real.reduce((best, p) => (p.v > best.v ? p : best)).i];
}

/**
 * Prints a value on the mark itself: the last point of a line, the peak, or
 * (for a short ranked list) the tip of every bar. Text uses the text colour,
 * never the series colour.
 *
 *   <Bar plugins={[valueLabels("all")]} … />
 */
export function valueLabels(
  mode: "last" | "peak" | "all" = "last",
  format: (value: number) => string = compactNumber,
): Plugin<"bar" | "line"> {
  return {
    id: `sparkValueLabels-${mode}`,
    afterDatasetsDraw(chart: Chart) {
      const { ctx } = chart;
      const horizontal = chart.options.indexAxis === "y";
      chart.data.datasets.forEach((dataset, d) => {
        const meta = chart.getDatasetMeta(d);
        if (meta.hidden) return;
        // The quiet comparison series is context: it gets no numbers.
        if (dataset.borderColor === chartQuiet()) return;
        const values = (dataset.data as Array<number | null>).map((v) =>
          typeof v === "number" ? v : null,
        );
        ctx.save();
        ctx.font = "600 12px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillStyle = chartText();
        for (const i of labelledPoints(values, mode)) {
          const el = meta.data[i];
          if (!el) continue;
          const text = format(values[i] as number);
          if (horizontal) {
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, el.x + 8, el.y);
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(text, el.x, el.y - 8);
          }
        }
        ctx.restore();
      });
    },
  };
}
