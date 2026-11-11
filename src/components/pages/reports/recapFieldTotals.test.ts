import { describe, expect, it } from "vitest";
import { countingBasisLine, fieldTotalNote, fieldTotalValue } from "./recapFieldTotals";

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
});
