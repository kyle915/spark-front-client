import { describe, expect, it } from "vitest";
import { briefFooter, bulletsToText, textToBullets } from "./programBrief";

describe("textToBullets", () => {
  it("keeps three non-empty lines", () => {
    expect(textToBullets("  Citrus  \n\nPassed on price\nAsked about sugar\nFourth")).toEqual([
      "Citrus",
      "Passed on price",
      "Asked about sugar",
    ]);
  });
});

describe("bulletsToText", () => {
  it("joins trimmed bullets with newlines", () => {
    expect(bulletsToText([" Citrus ", "", "Price"])).toBe("Citrus\nPrice");
  });
});

describe("briefFooter", () => {
  const reviewed = {
    status: "reviewed",
    isDraft: false,
    stale: false,
    autoReviewed: false,
    reviewedByName: "Sam Staff",
  };

  it("hides a changed count behind a rewrite", () => {
    expect(briefFooter({ ...reviewed, stale: true })).toContain("does not see this");
    expect(briefFooter({ ...reviewed, stale: true })).toContain("written again");
  });

  it("calls a draft a draft", () => {
    expect(briefFooter({ ...reviewed, status: "draft", isDraft: true })).toContain("Draft");
  });

  it("does not name a reviewer when the number check published it", () => {
    const line = briefFooter({ ...reviewed, autoReviewed: true, reviewedByName: null });
    expect(line).toContain("checked against this report");
    expect(line).not.toContain("Sam");
  });

  it("names the person who marked it reviewed", () => {
    expect(briefFooter(reviewed)).toContain("reviewed by Sam Staff");
  });
});
