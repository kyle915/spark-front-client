import { describe, expect, it } from "vitest";
import {
  compareRecapTriage,
  countRecapTriage,
  parseRecapTriageLabel,
  recapMatchesTriageFilter,
  recapTriageLabelForId,
  type RecapTriageSummary,
} from "./recapTriage";

describe("recapTriage", () => {
  it("parses labels with clean default", () => {
    expect(parseRecapTriageLabel("needs_eyes")).toBe("needs_eyes");
    expect(parseRecapTriageLabel("clean")).toBe("clean");
    expect(parseRecapTriageLabel(undefined)).toBe("clean");
    expect(parseRecapTriageLabel("weird")).toBe("clean");
  });

  it("filters and counts", () => {
    const byId = new Map<string, RecapTriageSummary>([
      ["1", { label: "clean", reasons: [] }],
      ["2", { label: "needs_eyes", reasons: [{ code: "gps", label: "GPS", source: "review_check" }] }],
    ]);
    expect(recapTriageLabelForId(byId, "1")).toBe("clean");
    expect(recapTriageLabelForId(byId, "missing")).toBe("clean");
    expect(recapMatchesTriageFilter("all", "clean")).toBe(true);
    expect(recapMatchesTriageFilter("clean", "needs_eyes")).toBe(false);
    expect(recapMatchesTriageFilter("needs_eyes", "needs_eyes")).toBe(true);
    expect(countRecapTriage(["1", "2", "3"], byId)).toEqual({
      clean: 2,
      needsEyes: 1,
    });
  });

  it("sorts needs_eyes first", () => {
    const byId = new Map<string, RecapTriageSummary>([
      ["a", { label: "clean", reasons: [] }],
      ["b", { label: "needs_eyes", reasons: [] }],
    ]);
    expect(compareRecapTriage("b", "a", byId)).toBeLessThan(0);
    expect(compareRecapTriage("a", "b", byId)).toBeGreaterThan(0);
  });
});
