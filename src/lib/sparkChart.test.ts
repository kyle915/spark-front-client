import { describe, expect, it } from "vitest";
import {
  MAX_SERIES,
  barSeries,
  chartInk,
  chartOptions,
  chartQuiet,
  compactNumber,
  foldToOther,
  labelledPoints,
  lineSeries,
  peakIndex,
  percentLabel,
  seriesColor,
} from "./sparkChart";

describe("spark chart style", () => {
  it("prints small numbers in full and large ones compactly", () => {
    expect(compactNumber(1284)).toBe("1,284");
    expect(compactNumber(12_940)).toBe("12.9K");
    expect(compactNumber(257_000)).toBe("257K");
    expect(compactNumber(4_200_000)).toBe("4.2M");
    expect(compactNumber(Number.NaN)).toBe("");
  });

  it("prints a rate as a percent with at most one decimal", () => {
    expect(percentLabel(40)).toBe("40%");
    expect(percentLabel(12.46)).toBe("12.5%");
    expect(percentLabel(Number.NaN)).toBe("");
    const o = chartOptions<"line">({ format: percentLabel }) as unknown as {
      scales: { y: { ticks: { callback: (v: number) => string } } };
    };
    expect(o.scales.y.ticks.callback(25)).toBe("25%");
  });

  it("never invents a fifth series colour", () => {
    const four = [0, 1, 2, 3].map(seriesColor);
    expect(new Set(four).size).toBe(MAX_SERIES);
    expect(seriesColor(MAX_SERIES)).toBe(chartQuiet());
    expect(seriesColor(-1)).toBe(chartQuiet());
  });

  it("never uses orange, which means needs-someone, as a series colour", () => {
    const oranges = ["#ef5a2a", "#d2481b", "#eb6834", "#d95926"];
    for (const c of [0, 1, 2, 3].map(seriesColor)) {
      expect(oranges).not.toContain(c.toLowerCase());
    }
  });

  it("folds a long tail into Other and keeps the leaders in order", () => {
    const rows = [
      { label: "A", value: 5 },
      { label: "B", value: 50 },
      { label: "C", value: 20 },
      { label: "D", value: 1 },
    ];
    expect(foldToOther(rows, 2)).toEqual([
      { label: "B", value: 50 },
      { label: "C", value: 20 },
      { label: "Other", value: 6 },
    ]);
    expect(foldToOther(rows, 10).map((r) => r.label)).toEqual(["B", "C", "A", "D"]);
  });

  it("inks one bar and quiets the rest when a bar is the point", () => {
    const bars = barSeries({ label: "Stores", data: [3, 9, 4], emphasis: peakIndex([3, 9, 4]) });
    expect(bars.backgroundColor).toEqual([chartQuiet(), chartInk(), chartQuiet()]);
    expect(bars.maxBarThickness).toBeLessThanOrEqual(24);
    expect(barSeries({ label: "x", data: [1, 2] }).backgroundColor).toBe(chartInk());
    // Context rows ("Other", "No store recorded") are quiet; the rest ink.
    expect(barSeries({ label: "x", data: [9, 4, 7], quiet: [2] }).backgroundColor).toEqual([
      chartInk(),
      chartInk(),
      chartQuiet(),
    ]);
    expect(barSeries({ label: "x", data: [1, 2], quiet: [] }).backgroundColor).toBe(chartInk());
  });

  it("marks only the last real point of a line, and none on the quiet one", () => {
    const line = lineSeries({ label: "Sampled", data: [1, 2, 3, null] });
    expect(line.pointRadius).toEqual([0, 0, 4, 0]);
    expect(line.borderWidth).toBe(2);
    const prior = lineSeries({ label: "Before", data: [1, 2, 3], quiet: true });
    expect(prior.pointRadius).toEqual([0, 0, 0]);
    expect(prior.borderColor).toBe(chartQuiet());
  });

  it("labels the last point or the peak, never every point by default", () => {
    expect(labelledPoints([1, 5, 3, null], "last")).toEqual([2]);
    expect(labelledPoints([1, 5, 3, null], "peak")).toEqual([1]);
    expect(labelledPoints([null, null], "last")).toEqual([]);
    expect(labelledPoints([1, 2], "all")).toEqual([0, 1]);
  });

  it("gives every chart one value scale, a hairline grid and no legend for one series", () => {
    const o = chartOptions<"bar">() as unknown as {
      scales: Record<string, { grid: { display?: boolean }; border: { display: boolean } }>;
      plugins: { legend: { display: boolean } };
    };
    expect(Object.keys(o.scales).sort()).toEqual(["x", "y"]);
    expect(o.scales.y.border.display).toBe(false);
    expect(o.scales.x.grid.display).toBe(false);
    expect(o.plugins.legend.display).toBe(false);
    expect(
      (chartOptions<"bar">({ legend: true }) as unknown as typeof o).plugins.legend.display,
    ).toBe(true);
  });
});
