import { describe, it, expect } from "vitest";
import {
  canonicalRetailerName,
  normalizeForMatch,
  shouldAutoResolveTyped,
} from "./GooglePlacesInput";

/**
 * Torch / public Spark request form — Account / Venue Name uses
 * GooglePlacesInput with bias="establishment" plus "+ USE … AS TYPED".
 * Blur used to always bind preds[0], rewriting free-text independents
 * (e.g. "Castle Heights Liquors & Wine") to fuzzy neighbors
 * ("New Castle Liquors"). These helpers gate that path.
 */
describe("shouldAutoResolveTyped — free-text vs fuzzy neighbor", () => {
  it("rejects Castle Heights Liquors vs New Castle Liquors", () => {
    expect(
      shouldAutoResolveTyped(
        "Castle Heights Liquors & Wine",
        "New Castle Liquors",
      ),
    ).toBe(false);
    expect(
      shouldAutoResolveTyped("Castle Heights Liquors", "New Castle Liquors"),
    ).toBe(false);
  });

  it("rejects unrelated Shoprite-style fuzzy hits", () => {
    expect(
      shouldAutoResolveTyped(
        "Castle Heights Liquors & Wine",
        "Shoprite LiquorShop Paarl 2",
      ),
    ).toBe(false);
  });

  it("accepts an exact (punctuation-insensitive) match", () => {
    expect(
      shouldAutoResolveTyped(
        "Castle Heights Liquors & Wine",
        "Castle Heights Liquors and Wine",
      ),
    ).toBe(true);
    expect(
      shouldAutoResolveTyped("Whole Foods Market", "Whole Foods Market"),
    ).toBe(true);
  });

  it("accepts a close prefix of a longer prediction label", () => {
    expect(
      shouldAutoResolveTyped("Whole Foods Market", "Whole Foods Market Brentwood"),
    ).toBe(true);
  });

  it("rejects short / mid-type fragments against a full label", () => {
    expect(shouldAutoResolveTyped("Cas", "Castle Heights Liquors")).toBe(false);
    expect(shouldAutoResolveTyped("New C", "New Castle Liquors")).toBe(false);
  });
});

describe("normalizeForMatch — ampersands and punctuation", () => {
  it("treats & as 'and' without dropping surrounding words", () => {
    expect(normalizeForMatch("Castle Heights Liquors & Wine")).toBe(
      "castle heights liquors and wine",
    );
  });

  it("collapses other punctuation to spaces", () => {
    expect(normalizeForMatch("Joe's Liquor — Downtown")).toBe(
      "joe s liquor downtown",
    );
  });
});

describe("canonicalRetailerName — preserves brand ampersands", () => {
  it("does not strip & from the brand", () => {
    expect(canonicalRetailerName("Castle Heights Liquors & Wine")).toBe(
      "Castle Heights Liquors & Wine",
    );
  });

  it("still strips location suffixes", () => {
    expect(
      canonicalRetailerName("Whole Foods Market - Brentwood"),
    ).toBe("Whole Foods Market");
  });
});
