import { describe, expect, it } from "vitest";
import {
  changeWords,
  columns,
  directionWord,
  groupMaxShare,
  monthName,
  share,
  trendsBasis,
  type SeriesRow,
  type Trends,
} from "./mentionTrends";

const trends: Trends = {
  months: ["2026-09", "2026-10"],
  recapCounts: [6, 9],
  compareMonth: "2026-10",
  priorMonth: "2026-09",
};

const sweet: SeriesRow = {
  key: "too_sweet",
  label: "Too sweet",
  polarity: "complaint",
  counts: [1, 5],
  total: 6,
  current: 5,
  previous: 1,
  currentShare: 56,
  previousShare: 17,
  direction: "rising",
};

describe("mentionTrends", () => {
  it("names months", () => {
    expect(monthName("2026-10")).toBe("October");
    expect(monthName("2026-01", true)).toBe("Jan");
    expect(monthName("nope")).toBe("nope");
  });

  it("puts every row on one scale by share of the month's recaps", () => {
    const other: SeriesRow = { ...sweet, key: "b", counts: [3, 0] };
    const max = groupMaxShare([sweet, other], trends);
    expect(max).toBe(share(5, 9));
    const cols = columns(other, trends, max);
    expect(cols[0].height).toBeCloseTo(50 / 56);
    expect(cols[1].height).toBe(0);
    expect(cols.map((c) => c.compared)).toEqual([false, true]);
    expect(cols[0].tooltip).toBe("September: 3 of 6 recaps (50%)");
  });

  it("words the change from the server's own counts", () => {
    expect(changeWords(sweet, trends)).toBe("5 of 9 recaps (56%) in October, from 1 of 6 (17%) in September");
    expect(changeWords(sweet, { ...trends, compareMonth: null })).toBe("6 recaps in these months");
    expect(directionWord("rising")).toBe("↑ Rising");
    expect(directionWord("too_few")).toBe("");
  });

  it("says what a trend needs when none is called", () => {
    expect(trendsBasis({ ...trends, compareMonth: null }, 6, 3)).toContain("so none is called yet");
    expect(trendsBasis(trends, 6, 3)).toContain("compare October with September");
  });
});
