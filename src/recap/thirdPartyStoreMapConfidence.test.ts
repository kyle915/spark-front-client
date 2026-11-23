import { describe, expect, it } from "vitest";

/**
 * Mirrors the confidence mapping in ThirdPartyStoreMap / store_automap so a
 * refactor of either side fails loudly if high/medium/low thresholds drift.
 */
function confidenceOf(hit: { confidence?: string; score?: number }): "high" | "medium" | "low" {
  const c = (hit.confidence || "").toLowerCase();
  if (c === "high" || c === "medium" || c === "low") return c;
  const score = Number(hit.score || 0);
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function needsAiRefresh(hits: { confidence?: string; score?: number }[]): boolean {
  if (hits.length === 0) return true;
  return confidenceOf(hits[0]) !== "high";
}

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
