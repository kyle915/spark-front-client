/**
 * Small pure derivations behind Spark's charts: nothing here imports a
 * component or a generated Relay file, so it can be unit-tested on its own.
 * None of it changes what is measured, only how rows are arranged to draw.
 */

export type ChartRow = { label: string; value: number };

/** Largest first; ties keep their incoming order. */
export function rankRows<T extends ChartRow>(rows: readonly T[], limit?: number): T[] {
  const sorted = rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => b.row.value - a.row.value || a.i - b.i)
    .map(({ row }) => row);
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

/** Rows that share a label become one row, summed, in first-seen order. */
export function mergeSameLabel(rows: readonly ChartRow[]): ChartRow[] {
  const byLabel = new Map<string, number>();
  for (const { label, value } of rows) byLabel.set(label, (byLabel.get(label) ?? 0) + value);
  return [...byLabel.entries()].map(([label, value]) => ({ label, value }));
}

/** A row's share of the whole as a rounded percent, 0 when there is no whole. */
export const sharePercent = (value: number, total: number): number =>
  total > 0 ? Math.round((value / total) * 100) : 0;

/** A short ranked list prints every value; a longer one leaves it to the axis. */
export const MAX_LABELLED_ROWS = 8;
export const labelsEveryRow = (rowCount: number): boolean =>
  rowCount > 0 && rowCount <= MAX_LABELLED_ROWS;

export type MeasureSeries = { key: string; label: string };

type TrendRow = { month: string; recaps: number };

const measure = (row: object, key: string): number =>
  Number((row as Record<string, unknown>)[key]) || 0;

/**
 * The monthly KPI trend used to draw recaps on a second y-axis over the
 * program's measures. They are two scales, so they become two charts that
 * share the month axis: the measures, and recaps on their own.
 */
export function splitMonthlyTrend<T extends TrendRow>(
  rows: readonly T[],
  series: readonly MeasureSeries[],
): {
  labels: string[];
  measures: Array<{ label: string; data: number[] }>;
  recaps: number[];
} {
  return {
    labels: rows.map((r) => r.month),
    measures: series.map((s) => ({
      label: s.label,
      data: rows.map((r) => measure(r, s.key)),
    })),
    recaps: rows.map((r) => r.recaps),
  };
}

/** Months with some activity but under 15% of the peak month. */
export function sparseMonthFlags<T extends TrendRow>(
  rows: readonly T[],
  series: readonly MeasureSeries[],
): boolean[] {
  const peaks = rows.map(
    (r) => Math.max(r.recaps, ...series.map((s) => measure(r, s.key))) || 0,
  );
  const peak = Math.max(...peaks, 0);
  if (peak <= 0) return rows.map(() => false);
  return peaks.map((m) => m > 0 && m < peak * 0.15);
}

/**
 * How a chart with N series is drawn. One series is ink with no legend; two
 * to `maxSeries` share one chart, a colour each, with a legend; more than
 * that become one small chart per series, because a fifth colour is never
 * generated and unrelated series cannot honestly be summed into "Other".
 */
export const seriesLayout = (
  seriesCount: number,
  maxSeries: number,
): "none" | "single" | "shared" | "multiples" => {
  if (seriesCount <= 0) return "none";
  if (seriesCount === 1) return "single";
  return seriesCount <= maxSeries ? "shared" : "multiples";
};
