import { describe, expect, it } from "vitest";
import { bestSlice, efficiencyHeadline, samplesPerHourText, type EfficiencyRow } from "./fieldEfficiency";

const row = (label: string, over: Partial<EfficiencyRow> = {}): EfficiencyRow => ({
  label,
  recaps: 3,
  sampled: 300,
  sold: 30,
  hours: 12,
  samplesPerHour: 25,
  unitsPerHour: 2.5,
  ...over,
});

describe("field efficiency", () => {
  it("shows a dash when there is no rate", () => {
    expect(samplesPerHourText(row("x", { samplesPerHour: null }))).toBe("—");
    expect(samplesPerHourText(row("x", { samplesPerHour: 1234.56 }))).toBe("1,234.6");
  });

  it("picks the best slice by units per hour, ignoring thin slices", () => {
    const best = bestSlice([
      row("Sat", { unitsPerHour: 4 }),
      row("Sun", { unitsPerHour: 9, recaps: 1 }), // one activation: not enough
      row("Fri", { unitsPerHour: 2 }),
    ]);
    expect(best?.label).toBe("Sat");
  });

  it("falls back to samples per hour when nothing sold", () => {
    const best = bestSlice([
      row("Morning", { unitsPerHour: 0, samplesPerHour: 10 }),
      row("Evening", { unitsPerHour: null, samplesPerHour: 40 }),
    ]);
    expect(best?.label).toBe("Evening");
  });

  it("returns nothing without clocked hours", () => {
    expect(bestSlice([row("Sat", { hours: 0 })])).toBeNull();
    expect(efficiencyHeadline([], [])).toBeNull();
  });

  it("writes a plain headline", () => {
    expect(
      efficiencyHeadline(
        [row("Sat", { unitsPerHour: 4 }), row("Tue", { unitsPerHour: 1 })],
        [row("Afternoon", { unitsPerHour: 5 }), row("Morning", { unitsPerHour: 2 })],
      ),
    ).toBe("Saturdays and afternoon shifts sell the most per hour.");
  });
});
