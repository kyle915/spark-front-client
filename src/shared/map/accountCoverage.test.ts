import { describe, expect, it } from "vitest";
import {
  coverageColor,
  coverageFromVisitCount,
  coverageLabel,
  parseCoverageClass,
} from "./accountCoverage";

describe("coverageFromVisitCount", () => {
  it("classifies 0 / 1 / >1 filed-recap visits", () => {
    expect(coverageFromVisitCount(0)).toBe("never_visited");
    expect(coverageFromVisitCount(1)).toBe("sampled");
    expect(coverageFromVisitCount(2)).toBe("repeat");
    expect(coverageFromVisitCount(9)).toBe("repeat");
  });
});

describe("parseCoverageClass + labels", () => {
  it("parses server slugs and falls back to never_visited", () => {
    expect(parseCoverageClass("sampled")).toBe("sampled");
    expect(parseCoverageClass("REPEAT")).toBe("repeat");
    expect(parseCoverageClass(null)).toBe("never_visited");
    expect(parseCoverageClass("bogus")).toBe("never_visited");
  });

  it("labels and colors each class distinctly", () => {
    expect(coverageLabel("sampled")).toBe("Sampled");
    expect(coverageLabel("repeat")).toBe("Repeat");
    expect(coverageLabel("never_visited")).toBe("Never visited");
    expect(new Set([coverageColor("sampled"), coverageColor("repeat"), coverageColor("never_visited")]).size).toBe(3);
  });
});
