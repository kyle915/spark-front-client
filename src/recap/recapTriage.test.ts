import { describe, expect, it } from "vitest";
import {
  compareRecapTriage,
  countRecapTriage,
  needsEyesWhyText,
  isRecapExplicitlyClean,
  parseRecapTriageLabel,
  recapMatchesTriageFilter,
  resolvedRecapTriageLabel,
  type RecapTriageSummary,
} from "./recapTriage";

describe("recapTriage", () => {
  it("parses labels with clean default for raw strings only", () => {
    expect(parseRecapTriageLabel("needs_eyes")).toBe("needs_eyes");
    expect(parseRecapTriageLabel("clean")).toBe("clean");
    expect(parseRecapTriageLabel(undefined)).toBe("clean");
    expect(parseRecapTriageLabel("weird")).toBe("clean");
  });

  it("treats missing map entries as unresolved, not Clean", () => {
    const byId = new Map<string, RecapTriageSummary>([
      ["1", { label: "clean", reasons: [] }],
      [
        "2",
        {
          label: "needs_eyes",
          reasons: [{ code: "gps", label: "GPS", source: "review_check" }],
        },
      ],
    ]);
    expect(resolvedRecapTriageLabel(byId, "1")).toBe("clean");
    expect(resolvedRecapTriageLabel(byId, "missing")).toBeNull();
    expect(isRecapExplicitlyClean(byId, "1")).toBe(true);
    expect(isRecapExplicitlyClean(byId, "missing")).toBe(false);
    expect(isRecapExplicitlyClean(byId, "2")).toBe(false);
    expect(recapMatchesTriageFilter("all", null)).toBe(true);
    expect(recapMatchesTriageFilter("clean", null)).toBe(false);
    expect(recapMatchesTriageFilter("needs_eyes", null)).toBe(false);
    expect(recapMatchesTriageFilter("clean", "needs_eyes")).toBe(false);
    expect(recapMatchesTriageFilter("needs_eyes", "needs_eyes")).toBe(true);
    expect(countRecapTriage(["1", "2", "3"], byId)).toEqual({
      clean: 1,
      needsEyes: 1,
      pending: 1,
      complete: false,
    });
    expect(countRecapTriage(["1", "2"], byId).complete).toBe(true);
  });

  it("sorts needs_eyes first, then unresolved, then clean", () => {
    const byId = new Map<string, RecapTriageSummary>([
      ["a", { label: "clean", reasons: [] }],
      ["b", { label: "needs_eyes", reasons: [] }],
    ]);
    expect(compareRecapTriage("b", "a", byId)).toBeLessThan(0);
    expect(compareRecapTriage("missing", "a", byId)).toBeLessThan(0);
    expect(compareRecapTriage("b", "missing", byId)).toBeLessThan(0);
  });

  it("shows a why line only for Needs Eyes", () => {
    expect(
      needsEyesWhyText({
        label: "needs_eyes",
        reasons: [],
        why: "  The shelf has a gap.  ",
      }),
    ).toBe("The shelf has a gap.");
    expect(
      needsEyesWhyText({ label: "clean", reasons: [], why: "Should stay hidden." }),
    ).toBeNull();
    expect(needsEyesWhyText(null)).toBeNull();
  });
});
