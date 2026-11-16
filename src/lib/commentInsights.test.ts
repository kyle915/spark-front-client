import { describe, expect, it } from "vitest";
import {
  NOT_ENOUGH,
  NO_LEADER,
  brandBars,
  mentionsBasis,
  moreBrands,
  regionCell,
  regionColumns,
  regionsBasis,
  stanceWords,
  topBrands,
  type RegionRow,
} from "./commentInsights";

const brand = (name: string, recapCount: number, ours = 0, theirs = 0, neutral = 0) => ({
  brand: name,
  recapCount,
  preferOurs: ours,
  preferTheirs: theirs,
  neutral,
  quote: `${name} quote`,
});

describe("other brands", () => {
  it("ranks brands by recaps and keeps the counts as given", () => {
    const brands = [brand("Truly", 2), brand("White Claw", 9), brand("", 5), brand("Zero", 0)];
    expect(brandBars(brands)).toEqual([
      { label: "White Claw", value: 9 },
      { label: "Truly", value: 2 },
    ]);
    expect(topBrands(brands)[0]).toEqual(brand("White Claw", 9));
  });

  it("counts the brands it leaves out in words, never as an Other bar", () => {
    const brands = Array.from({ length: 11 }, (_, i) => brand(`Brand ${i}`, 20 - i));
    expect(brandBars(brands)).toHaveLength(8);
    expect(brandBars(brands).some((b) => b.label === "Other")).toBe(false);
    expect(moreBrands(brands)).toBe("and 3 more brands");
    expect(moreBrands(brands.slice(0, 9))).toBe("and 1 more brand");
    expect(moreBrands(brands.slice(0, 8))).toBe("");
  });

  it("puts the stance split in words and leaves out the zeros", () => {
    expect(stanceWords(brand("A", 10, 7, 2, 1))).toBe(
      "7 preferred yours, 2 preferred theirs, 1 only mentioned it",
    );
    expect(stanceWords(brand("A", 3, 0, 0, 3))).toBe("3 only mentioned it");
    expect(stanceWords(brand("A", 0))).toBe("");
  });

  it("says what the brands were read from", () => {
    expect(mentionsBasis(4, 60, 22)).toBe(
      "4 comments name another brand, out of 60 comments on 22 approved recaps. Read by AI; each count is recaps, and a brand is listed only when it is written in the comment.",
    );
    expect(mentionsBasis(1, 150, 80, true)).toContain(
      "1 comment names another brand, out of the most recent 150 comments",
    );
  });
});

const row = (over: Partial<RegionRow> = {}): RegionRow => ({
  state: "TX",
  recaps: 4,
  soldStatus: "ready",
  soldProduct: "Citrus Splash",
  soldUnits: 1900,
  soldRecaps: 3,
  sampledStatus: "too_few",
  sampledProduct: null,
  sampledUnits: 0,
  sampledRecaps: 1,
  spokenStatus: "ready",
  spokenProduct: "Berry Blast",
  spokenPositive: 3,
  spokenNegative: 1,
  spokenRecaps: 4,
  ...over,
});

describe("what sells where", () => {
  it("shows only the columns that have something behind them", () => {
    expect(regionColumns(true, true, "ready").map((c) => c.key)).toEqual([
      "sold",
      "sampled",
      "spoken",
    ]);
    expect(regionColumns(false, true, "unavailable").map((c) => c.key)).toEqual(["sampled"]);
    expect(regionColumns(false, false, "none")).toEqual([]);
  });

  it("names a product with its base", () => {
    expect(regionCell(row(), "sold")).toEqual({
      lead: "Citrus Splash",
      named: true,
      basis: "1,900 units · of 3 recaps",
    });
    expect(regionCell(row(), "spoken")).toEqual({
      lead: "Berry Blast",
      named: true,
      basis: "3 spoke well of it, 1 did not · of 4 recaps",
    });
    expect(regionCell(row({ spokenNegative: 0 }), "spoken").basis).toBe(
      "3 spoke well of it · of 4 recaps",
    );
    expect(
      regionCell(
        row({ sampledStatus: "ready", sampledProduct: "Berry Blast", sampledUnits: 1, sampledRecaps: 3 }),
        "sampled",
      ).basis,
    ).toBe("1 sample · of 3 recaps");
  });

  it("says not enough data rather than naming a product on thin data", () => {
    expect(regionCell(row(), "sampled")).toEqual({
      lead: NOT_ENOUGH,
      named: false,
      basis: "of 1 recap",
    });
    expect(regionCell(row({ soldStatus: "no_leader", soldProduct: null }), "sold").lead).toBe(
      NO_LEADER,
    );
    // A product with a status that is not ready is still not shown.
    expect(regionCell(row({ soldStatus: "too_few" }), "sold").lead).toBe(NOT_ENOUGH);
    expect(regionCell(row({ sampledRecaps: 0 }), "sampled").basis).toBe("");
  });

  it("states the floor, and the AI part only when that column is shown", () => {
    const numbers = regionsBasis(3, regionColumns(true, false, "none"));
    expect(numbers).toBe(
      "From approved recaps. A state names a product only on 3 or more recaps from more than one event.",
    );
    expect(regionsBasis(3, regionColumns(true, false, "ready"))).toContain("read by AI");
  });
});
