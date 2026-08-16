import { describe, expect, it } from "vitest";
import {
  ASK_AI_FOLLOWUPS,
  jumpOriginCss,
  recapReviewStatus,
  thoughtLabel,
  thoughtSeconds,
} from "./opsMotion";

describe("thoughtSeconds", () => {
  it("rounds real elapsed time and never reports zero", () => {
    expect(thoughtSeconds(2800)).toBe(3);
    expect(thoughtSeconds(400)).toBe(1);
    expect(thoughtSeconds(-12)).toBe(1);
  });
});

describe("thoughtLabel", () => {
  it("collapses to an elapsed thought line", () => {
    expect(thoughtLabel(3)).toBe("Thought for 3s");
  });
});

describe("recapReviewStatus", () => {
  it("morphs Needs review into Approved", () => {
    expect(recapReviewStatus(false)).toBe("Needs review");
    expect(recapReviewStatus(true)).toBe("Approved");
  });
});

describe("Ask AI follow-ups", () => {
  it("keeps three tenant-scoped chips", () => {
    expect(ASK_AI_FOLLOWUPS).toEqual([
      "Missing recaps this week?",
      "Which BAs filed late?",
      "Which venues had zero samples?",
    ]);
  });
});

describe("jumpOriginCss", () => {
  it("falls back to a top-center origin", () => {
    expect(jumpOriginCss(null)).toBe("50% 16%");
  });
});
