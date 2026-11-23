import { describe, expect, it } from "vitest";
import {
  countingBasisLine,
  fieldTotalNote,
  fieldTotalValue,
  partitionSampledQuestions,
  sampledPartsIntro,
} from "./recapFieldTotals";

const base = { label: "x", average: 0, recaps: 3, isPercent: false };

describe("recap field totals", () => {
  it("formats counts, money and averages", () => {
    expect(fieldTotalValue({ ...base, kind: "count", total: 24352 })).toBe("24,352");
    expect(fieldTotalValue({ ...base, kind: "money", total: 1050.5 })).toBe("$1,050.50");
    expect(fieldTotalValue({ ...base, kind: "average", total: 12.789 })).toBe("12.79");
    expect(
      fieldTotalValue({ ...base, kind: "average", total: 5.06, isPercent: true }),
    ).toBe("5.1%");
  });

  it("labels averages as averages", () => {
    expect(fieldTotalNote({ ...base, kind: "average", total: 1 })).toBe(
      "average across 3 recaps",
    );
    expect(fieldTotalNote({ ...base, kind: "count", total: 1, recaps: 1 })).toBe(
      "total across 1 recap",
    );
  });

  it("counts in store-days when the brand is counted once per store per day", () => {
    expect(fieldTotalNote({ ...base, kind: "count", total: 1 }, true)).toBe(
      "total across 3 store-days",
    );
    expect(fieldTotalNote({ ...base, kind: "average", total: 1, recaps: 1 }, true)).toBe(
      "average across 1 store-day",
    );
    expect(countingBasisLine(true)).toContain("once per store per day");
    expect(countingBasisLine(false)).not.toContain("store per day");
  });

  it("lifts sampled questions out of the metric grid", () => {
    const split = partitionSampledQuestions([
      {
        section: "Sampling",
        fields: [
          { ...base, label: "Total number of consumers sampled", kind: "count", total: 4034, sampledQuestion: true, recaps: 58 },
          { ...base, label: "How many TOTAL consumers did you sample?", kind: "count", total: 19276, sampledQuestion: true, recaps: 25 },
          { ...base, label: "Willing to purchase", kind: "count", total: 7783, sampledQuestion: false },
        ],
      },
    ]);
    expect(split.parts.map((f) => f.total)).toEqual([4034, 19276]);
    expect(split.sections[0].fields.map((f) => f.label)).toEqual(["Willing to purchase"]);
    expect(sampledPartsIntro(split.parts, 23310)).toContain("23,310");
    expect(sampledPartsIntro(split.parts, 100)).toBe(
      "These questions are what the consumers sampled total counts.",
    );
  });
});
