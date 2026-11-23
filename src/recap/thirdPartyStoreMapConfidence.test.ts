import { describe, expect, it } from "vitest";
import {
  confidenceOf,
  needsAiRefresh,
} from "./thirdPartyStoreMapConfidence";

describe("third-party store map confidence", () => {
  it("treats score >= 80 as high", () => {
    expect(confidenceOf({ score: 95 })).toBe("high");
    expect(confidenceOf({ score: 80 })).toBe("high");
    expect(confidenceOf({ score: 55 })).toBe("medium");
    expect(confidenceOf({ score: 40 })).toBe("low");
  });

  it("prefers explicit confidence over score", () => {
    expect(confidenceOf({ score: 95, confidence: "medium" })).toBe("medium");
  });

  it("asks for AI refresh when empty or not high-confidence", () => {
    expect(needsAiRefresh([])).toBe(true);
    expect(needsAiRefresh([{ score: 60 }])).toBe(true);
    expect(needsAiRefresh([{ score: 90 }])).toBe(false);
    expect(needsAiRefresh([{ confidence: "high", score: 50 }])).toBe(false);
  });
});
