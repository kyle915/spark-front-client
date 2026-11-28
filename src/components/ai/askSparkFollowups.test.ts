import { describe, expect, it } from "vitest";
import { deriveAskSparkFollowups } from "./askSparkFollowups";
import { parseCsvTokens } from "@/components/pages/reports/regionalAlertsHelpers";

describe("deriveAskSparkFollowups", () => {
  it("suggests store and wave follow-ups after a store performance answer", () => {
    const chips = deriveAskSparkFollowups({
      question: "Which Whole Foods stores converted best last month?",
      answer: "Whole Foods Lamar led with 48% conversion across 110 consumers sampled.",
      sourceTools: ["top_stores"],
      pathname: "/reports",
    });
    expect(chips.length).toBe(3);
    expect(chips).toContain("Draft a wave for these stores");
    expect(chips.some((c) => c.toLowerCase().includes("compare"))).toBe(true);
  });

  it("suggests shelf & MSRP follow-ups after an OOS/shelf turn", () => {
    const chips = deriveAskSparkFollowups({
      question: "Where did we see out-of-stock gaps?",
      answer: "H-E-B #104 and Sprouts #12 logged OOS gaps with a missing price tag.",
      sourceTools: ["shelf_summary"],
      pathname: "/shelf-voice",
    });
    expect(chips.length).toBe(3);
    expect(chips.some((c) => c.toLowerCase().includes("msrp") || c.toLowerCase().includes("oos"))).toBe(true);
  });

  it("deduplicates questions already asked earlier in the thread", () => {
    const chips = deriveAskSparkFollowups({
      question: "Draft a wave for these stores",
      answer: "Here is a 10-store draft wave for Texas.",
      priorQuestions: [
        "Compare vs. last month",
        "Rank our top 5 converting doors",
      ],
    });
    expect(chips.length).toBe(3);
    expect(chips).not.toContain("Draft a wave for these stores");
    expect(chips).not.toContain("Compare vs. last month");
    expect(chips).not.toContain("Rank our top 5 converting doors");
  });

  it("never suggests Spark Help topics", () => {
    const chips = deriveAskSparkFollowups({
      question: "Summarize our shopper comments",
      answer: "Shoppers loved the citrus flavor.",
    });
    for (const c of chips) {
      expect(c.toLowerCase()).not.toContain("spark help");
      expect(c.toLowerCase()).not.toContain("how do i use spark");
    }
  });
});

describe("parseCsvTokens", () => {
  it("splits comma and semicolon separated state/chain tokens cleanly", () => {
    expect(parseCsvTokens("TX, CA; NY , ")).toEqual(["TX", "CA", "NY"]);
    expect(parseCsvTokens("H-E-B, Whole Foods")).toEqual(["H-E-B", "Whole Foods"]);
    expect(parseCsvTokens("")).toEqual([]);
  });
});
