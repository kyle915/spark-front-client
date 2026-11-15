import { describe, expect, it } from "vitest";
import { suggestionSentence, tickedByDefault } from "./retailerSuggestionCopy";

const base = { name: "Kroger", confidence: "high", sourceLabel: "the staffing sheet", isNewRetailer: false };

describe("retailer suggestion copy", () => {
  it("says where the suggestion came from", () => {
    expect(suggestionSentence(base)).toBe("Spark suggests Kroger, from the staffing sheet.");
  });

  it("warns when the store is new or the suggestion is a guess", () => {
    expect(suggestionSentence({ ...base, isNewRetailer: true })).toContain("new retailer");
    expect(suggestionSentence({ ...base, confidence: "low" })).toContain("guess");
  });

  it("ticks the approve box only for a sure suggestion", () => {
    expect(tickedByDefault(base)).toBe(true);
    expect(tickedByDefault({ confidence: "medium" })).toBe(false);
    expect(tickedByDefault({ confidence: "low" })).toBe(false);
    expect(tickedByDefault(null)).toBe(false);
  });

  it("asks the reviewer to check a less-sure suggestion", () => {
    expect(suggestionSentence({ ...base, confidence: "medium" })).toContain("Check it");
    expect(suggestionSentence(base)).not.toContain("Check it");
  });
});
