import { describe, expect, it } from "vitest";
import {
  labelsEveryRow,
  mergeSameLabel,
  rankRows,
  seriesLayout,
  sharePercent,
  sparseMonthFlags,
  splitMonthlyTrend,
} from "./chartRows";

describe("chart rows", () => {
  it("ranks largest first, keeps ties in order and can cap the list", () => {
    const rows = [
      { label: "A", value: 2 },
      { label: "B", value: 9 },
      { label: "C", value: 2 },
      { label: "D", value: 5 },
    ];
    expect(rankRows(rows).map((r) => r.label)).toEqual(["B", "D", "A", "C"]);
    expect(rankRows(rows, 2).map((r) => r.label)).toEqual(["B", "D"]);
    expect(rows[0].label).toBe("A");
  });

  it("sums rows that carry the same label", () => {
    expect(
      mergeSameLabel([
        { label: "Demo", value: 4 },
        { label: "Other", value: 1 },
        { label: "Other", value: 2 },
      ]),
    ).toEqual([
      { label: "Demo", value: 4 },
      { label: "Other", value: 3 },
    ]);
  });

  it("gives a share of the whole and never divides by nothing", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(5, 0)).toBe(0);
  });

  it("prints every value only on a short list", () => {
    expect(labelsEveryRow(8)).toBe(true);
    expect(labelsEveryRow(9)).toBe(false);
    expect(labelsEveryRow(0)).toBe(false);
  });

  it("splits the monthly trend into measures and recaps on one month axis", () => {
    const rows = [
      { month: "Jan", recaps: 2, engagements: 100, samples: 80 },
      { month: "Feb", recaps: 5, engagements: 300, samples: 0 },
    ];
    const split = splitMonthlyTrend(rows, [
      { key: "engagements", label: "Engagements" },
      { key: "samples", label: "Samples" },
    ]);
    expect(split.labels).toEqual(["Jan", "Feb"]);
    expect(split.measures).toEqual([
      { label: "Engagements", data: [100, 300] },
      { label: "Samples", data: [80, 0] },
    ]);
    expect(split.recaps).toEqual([2, 5]);
  });

  it("reads a missing measure as zero rather than NaN", () => {
    const split = splitMonthlyTrend([{ month: "Jan", recaps: 1 }], [
      { key: "unitsSold", label: "Units sold" },
    ]);
    expect(split.measures[0].data).toEqual([0]);
  });

  it("flags light months against the peak, and none when nothing happened", () => {
    const series = [{ key: "samples", label: "Samples" }];
    const rows = [
      { month: "Jan", recaps: 1, samples: 10 },
      { month: "Feb", recaps: 9, samples: 400 },
      { month: "Mar", recaps: 0, samples: 0 },
    ];
    expect(sparseMonthFlags(rows, series)).toEqual([true, false, false]);
    expect(sparseMonthFlags([{ month: "Jan", recaps: 0, samples: 0 }], series)).toEqual([false]);
  });

  it("never asks for a fifth colour: many series become small multiples", () => {
    expect(seriesLayout(0, 4)).toBe("none");
    expect(seriesLayout(1, 4)).toBe("single");
    expect(seriesLayout(4, 4)).toBe("shared");
    expect(seriesLayout(5, 4)).toBe("multiples");
  });
});
