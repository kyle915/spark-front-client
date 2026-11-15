import { describe, expect, it } from "vitest";
import {
  contextIndexes,
  isCutOff,
  lastWeeksWindow,
  mondayOf,
  ofAsked,
  perEvent,
  productSplit,
  rankedSplit,
  shortLabel,
  weeklyTrend,
  type SplitRow,
} from "./consumerBreakdown";

const named = (label: string, consumers: number): SplitRow => ({ label, kind: "named", consumers });

describe("rankedSplit", () => {
  it("never leads with the rows that have no store recorded", () => {
    const split = rankedSplit(
      [named("Costco", 150), named("Kroger", 60), { label: "", kind: "missing", consumers: 900 }],
      { missingLabel: "No store recorded" },
    );
    expect(split.bars.map((b) => b.label)).toEqual(["Costco", "Kroger", "No store recorded"]);
    expect(split.bars.at(-1)).toEqual({ label: "No store recorded", value: 900, context: true });
    expect(contextIndexes(split.bars)).toEqual([2]);
    expect(split.total).toBe(1110);
  });

  it("folds the tail into Other, after the named rows and before the unrecorded ones", () => {
    const rows = [
      ...[90, 80, 70, 60, 50, 40, 30, 20].map((v, i) => named(`Store ${i}`, v)),
      { label: "", kind: "missing", consumers: 5 },
    ];
    const split = rankedSplit(rows, { missingLabel: "No store recorded", keep: 6 });
    expect(split.bars.map((b) => b.label)).toEqual([
      "Store 0",
      "Store 1",
      "Store 2",
      "Store 3",
      "Store 4",
      "Store 5",
      "Other",
      "No store recorded",
    ]);
    expect(split.bars[6]).toEqual({ label: "Other", value: 50, context: true });
    expect(split.aside).toBeNull();
    // The bars add up to the whole split: nothing is dropped by folding.
    expect(split.bars.reduce((s, b) => s + b.value, 0)).toBe(split.total);
  });

  it("adds a tail the server already folded to its own", () => {
    const split = rankedSplit(
      [named("A", 100), named("B", 90), named("C", 80), { label: "", kind: "other", consumers: 40 }],
      { missingLabel: "No store recorded", keep: 2, namedCount: 20 },
    );
    expect(split.bars.map((b) => [b.label, b.value])).toEqual([
      ["A", 100],
      ["B", 90],
      ["Other", 120],
    ]);
    expect(split.namedCount).toBe(20);
  });

  it("says a tail that would dwarf the chart in words instead of drawing it", () => {
    const rows = [named("A", 100), named("B", 90), ...Array.from({ length: 40 }, (_, i) => named(`T${i}`, 50))];
    const split = rankedSplit(rows, { missingLabel: "No store recorded", keep: 2 });
    expect(split.bars.map((b) => b.label)).toEqual(["A", "B"]);
    expect(split.aside).toEqual({ count: 40, value: 2000 });
    expect(split.bars.reduce((s, b) => s + b.value, 0) + (split.aside?.value ?? 0)).toBe(split.total);
  });

  it("is empty when nothing was sampled", () => {
    const split = rankedSplit([named("Costco", 0)], { missingLabel: "No store recorded" });
    expect(split.bars).toEqual([]);
    expect(split.total).toBe(0);
  });
});

describe("productSplit", () => {
  it("folds what the listed products leave of the total into Other", () => {
    const split = productSplit(
      [
        { product: "Mango", samples: 300 },
        { product: "Lime", samples: 200 },
      ],
      560,
    );
    expect(split.bars.map((b) => [b.label, b.value])).toEqual([
      ["Mango", 300],
      ["Lime", 200],
      ["Other", 60],
    ]);
    expect(split.total).toBe(560);
  });

  it("labels a product by its name when the type prefix is not needed", () => {
    const typed = productSplit(
      [
        { product: "Sparkling — Mango Chainsaw", samples: 30 },
        { product: "Tea — Grim Leafer", samples: 20 },
      ],
      50,
    );
    expect(typed.bars.map((b) => b.label)).toEqual(["Mango Chainsaw", "Grim Leafer"]);
    // Two types share a name: the type stays so the rows can be told apart.
    const clash = productSplit(
      [
        { product: "Cans — Original", samples: 30 },
        { product: "Bottles — Original", samples: 20 },
      ],
      50,
    );
    expect(clash.bars.map((b) => b.label)).toEqual(["Cans — Original", "Bottles — Original"]);
  });

  it("does not claim to know how many products are behind a large Other", () => {
    const split = productSplit([{ product: "Mango", samples: 10 }], 500);
    expect(split.bars.map((b) => b.label)).toEqual(["Mango"]);
    expect(split.aside).toEqual({ count: null, value: 490 });
  });
});

describe("weekly trend", () => {
  // Wednesday 14 Oct 2026.
  const today = new Date(2026, 9, 14);

  it("starts each week on Monday", () => {
    expect(mondayOf(today).getDate()).toBe(12);
    expect(mondayOf(new Date(2026, 9, 18)).getDate()).toBe(12); // Sunday
    expect(mondayOf(new Date(2026, 9, 12)).getDate()).toBe(12); // Monday
  });

  it("covers twelve finished weeks and leaves out the one in progress", () => {
    expect(lastWeeksWindow(12, today)).toEqual({ startDate: "2026-07-20", endDate: "2026-10-11" });
    expect(lastWeeksWindow(1, today)).toEqual({ startDate: "2026-10-05", endDate: "2026-10-11" });
    // On a Monday the week that just ended is the last one shown.
    expect(lastWeeksWindow(1, new Date(2026, 9, 12))).toEqual({
      startDate: "2026-10-05",
      endDate: "2026-10-11",
    });
    // On a Sunday that week is still in progress.
    expect(lastWeeksWindow(1, new Date(2026, 9, 18))).toEqual({
      startDate: "2026-10-05",
      endDate: "2026-10-11",
    });
  });

  it("names the week in progress so a part week does not read as a drop", () => {
    const trend = weeklyTrend(
      [
        { weekStart: "2026-09-28", consumers: 0 },
        { weekStart: "2026-10-05", consumers: 400 },
        { weekStart: "2026-10-12", consumers: 190 },
      ],
      today,
    );
    expect(trend.labels).toEqual(["Sep 28", "Oct 5", "This week"]);
    expect(trend.values).toEqual([0, 400, 190]);
    expect(trend.hasData).toBe(true);
  });

  it("has no data when every week is empty", () => {
    expect(weeklyTrend([{ weekStart: "2026-10-05", consumers: 0 }], today).hasData).toBe(false);
    expect(weeklyTrend([], today).hasData).toBe(false);
  });
});

describe("ofAsked", () => {
  it("prints the rate with the consumers it is out of", () => {
    expect(ofAsked(61.6, 1240)).toEqual({ rate: "62%", asked: "of 1,240 asked" });
  });

  it("prints the rate alone when the base is unknown, never an invented one", () => {
    expect(ofAsked(40, null)).toEqual({ rate: "40%", asked: null });
    expect(ofAsked(40, 0)).toEqual({ rate: "40%", asked: null });
  });

  it("prints nothing when there is no rate", () => {
    expect(ofAsked(null, 500)).toBeNull();
    expect(ofAsked(undefined, undefined)).toBeNull();
  });
});

describe("isCutOff", () => {
  it("is true only when more rows match than were returned", () => {
    expect(isCutOff(2000, 2412)).toBe(true);
    expect(isCutOff(180, 180)).toBe(false);
    expect(isCutOff(180, null)).toBe(false);
  });
});

describe("shortLabel", () => {
  it("leaves a short name alone", () => {
    expect(shortLabel("Costco")).toBe("Costco");
  });

  it("cuts a long name and marks the cut", () => {
    expect(shortLabel("Sprouts Farmers Market")).toBe("Sprouts Farmers M…");
    expect(shortLabel("Whole Foods Market — Lamar")).toBe("Whole Foods Marke…");
    expect(shortLabel("Supercalifragilisticexpialidocious Foods", 12)).toBe("Supercalifr…");
  });
});

describe("perEvent", () => {
  it("divides consumers by events, whole above ten and one decimal under", () => {
    expect(perEvent(1440, 30)).toBe(48);
    expect(perEvent(1450, 30)).toBe(48);
    expect(perEvent(25, 4)).toBe(6.3);
  });

  it("is null when there is nothing to divide", () => {
    expect(perEvent(0, 5)).toBeNull();
    expect(perEvent(100, 0)).toBeNull();
  });
});
