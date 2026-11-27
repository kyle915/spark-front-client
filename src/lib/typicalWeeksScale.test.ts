import { describe, expect, it } from "vitest";
import {
  computeTypicalWeeksScale,
  niceAxisCeiling,
} from "./typicalWeeksScale";

describe("niceAxisCeiling", () => {
  it("rounds ceilings to clean tick intervals instead of awkward numbers like 4,617", () => {
    // 3,700 * 1.15 = 4,255 -> 5,000 in 5 steps of 1,000
    expect(niceAxisCeiling(3700 * 1.15)).toEqual({
      axisMax: 5000,
      stepSize: 1000,
    });
    expect(niceAxisCeiling(420 * 1.15)).toEqual({
      axisMax: 500,
      stepSize: 100,
    });
    expect(niceAxisCeiling(1800 * 1.15)).toEqual({
      axisMax: 2500,
      stepSize: 500,
    });
  });
});

describe("computeTypicalWeeksScale", () => {
  it("splits an extreme event week into a clean ceiling, gap-safe typical data, and neighbor connectors", () => {
    const labels = [
      "Aug 31",
      "Sep 7",
      "Sep 14",
      "Sep 21",
      "Sep 28",
      "Oct 5",
      "Oct 12",
      "Oct 19",
      "Oct 26",
      "Nov 2",
      "Nov 9",
      "Nov 16",
    ];
    const values = [300, 2900, 1500, 3700, 650, 300, 500, 320, 100, 10150, 400, 100];
    const scale = computeTypicalWeeksScale(values, labels);
    expect(scale).not.toBeNull();
    expect(scale?.axisMax).toBe(5000);
    expect(scale?.stepSize).toBe(1000);
    expect(scale?.peakLabel).toBe("Nov 2");
    expect(scale?.outlierIndices).toEqual([9]);
    // Outlier week is nulled in typicalData so Oct 26 / Nov 9 splines don't bend or clip
    expect(scale?.typicalData[9]).toBeNull();
    expect(scale?.typicalData[8]).toBe(100);
    expect(scale?.typicalData[10]).toBe(400);
    // Dashed connector bridges Oct 26 -> Nov 2 (capped at 5000) -> Nov 9
    expect(scale?.connectorData.slice(7, 12)).toEqual([
      null,
      100,
      5000,
      400,
      null,
    ]);
  });

  it("returns null when weekly values have no extreme outlier", () => {
    expect(
      computeTypicalWeeksScale(
        [400, 520, 610, 480, 700, 550],
        ["W1", "W2", "W3", "W4", "W5", "W6"],
      ),
    ).toBeNull();
  });
});
