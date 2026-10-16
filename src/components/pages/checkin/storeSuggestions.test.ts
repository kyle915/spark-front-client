import { describe, expect, it } from "vitest";
import { matchingStores, storeNameForPicker } from "./storeSuggestions";

const valley = {
  name: "Valley Beer Drive In",
  address: "7117 Vine St, Cincinnati, OH 45216",
};
const shell = {
  name: "Shell",
  address: "1303 S Main St, Bluffton, IN 46714",
};
const titled = {
  name: "8/2/2026 - 7117 Vine St, Cincinnati, OH 45216",
  address: "7117 Vine St, Cincinnati, OH 45216",
};

describe("matchingStores", () => {
  const stores = [valley, shell, titled];

  it("finds a roster store by its trading name", () => {
    expect(matchingStores(stores, "valley beer")).toEqual([valley]);
  });

  it("finds a store by street or city when the name is generic", () => {
    expect(matchingStores(stores, "shell bluffton")).toEqual([shell]);
  });

  it("waits for two characters", () => {
    expect(matchingStores(stores, "v")).toEqual([]);
    expect(matchingStores(stores, "  ")).toEqual([]);
  });

  it("does not treat a legal-entity string as the store name", () => {
    expect(matchingStores(stores, "jay sanderi")).toEqual([]);
  });
});

describe("storeNameForPicker", () => {
  it("keeps the trading name", () => {
    expect(storeNameForPicker(valley)).toBe("Valley Beer Drive In");
  });

  it("drops walk-in titles that repeat the address or a date", () => {
    expect(storeNameForPicker(titled)).toBe("");
    expect(
      storeNameForPicker({
        name: "fast fuel · 2026-11-03",
        address: "1773 S Green St, Henderson, KY 42420",
      }),
    ).toBe("");
  });
});
