import { describe, expect, it } from "vitest";
import {
  bestSlice,
  cleanRates,
  efficiencyHeadline,
  samplesPerHourText,
  type EfficiencyRow,
} from "./fieldEfficiency";

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
    expect(samplesPerHourText(row("x", { samplesPerHour: 12.34 }))).toBe("12.3");
  });

  it("holds a rate the clock cannot support", () => {
    const held = cleanRates(row("Chevron", { samplesPerHour: 5500, unitsPerHour: 2400, sold: 2400 }));
    expect(held.samplesPerHour).toBeNull();
    expect(held.unitsPerHour).toBeNull();
    expect(held.sold).toBe(2400);
    expect(samplesPerHourText(row("Albertsons", { samplesPerHour: 294.1 }))).toBe("—");
    expect(bestSlice([row("Fri", { unitsPerHour: 5500 }), row("Sat", { unitsPerHour: 3.1 })])?.label).toBe(
      "Sat",
    );
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

  it("does not call a samples shift a sales leader", () => {
    expect(
      efficiencyHeadline(
        [row("Fri", { unitsPerHour: 3 })],
        [row("Midday", { unitsPerHour: null, samplesPerHour: 20 })],
      ),
    ).toBe("Fridays sell the most per hour. Midday shifts sample the most per hour.");
  });
});
