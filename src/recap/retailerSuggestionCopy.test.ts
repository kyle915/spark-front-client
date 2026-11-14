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

  it("ticks the approve box by default except for a guess or no suggestion", () => {
    expect(tickedByDefault(base)).toBe(true);
    expect(tickedByDefault({ confidence: "medium" })).toBe(true);
    expect(tickedByDefault({ confidence: "low" })).toBe(false);
    expect(tickedByDefault(null)).toBe(false);
  });
});
