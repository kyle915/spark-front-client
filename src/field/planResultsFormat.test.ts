import { describe, expect, it } from "vitest";
import {
  fmtMetricValue,
  pctOfPlan,
  planDateLabel,
  recapStatusLabel,
  resultsBadge,
} from "./planResultsFormat";

describe("plan results format", () => {
  it("formats values by unit", () => {
    expect(fmtMetricValue(null, "emails")).toBe("—");
    expect(fmtMetricValue(1234, "emails")).toBe("1,234");
    expect(fmtMetricValue(42.5, "mi")).toBe("42.5 mi");
    expect(fmtMetricValue(6, "h")).toBe("6 h");
    expect(fmtMetricValue(24.8, "$")).toBe("$24.80");
  });

  it("only compares when something was planned and something came in", () => {
    expect(pctOfPlan(150, 170)).toBe(113);
    expect(pctOfPlan(0, 170)).toBeNull();
    expect(pctOfPlan(null, 170)).toBeNull();
    expect(pctOfPlan(150, null)).toBeNull();
  });

  it("keeps review recaps visibly out of totals", () => {
    expect(recapStatusLabel("approved")).toBe("Approved");
    expect(recapStatusLabel("needs_review")).toMatch(/not in totals/);
    expect(recapStatusLabel("archived")).toMatch(/not in totals/);
    expect(recapStatusLabel("third_party")).toBe("3rd party · not in totals");
  });

  it("labels plan dates and results badges", () => {
    expect(planDateLabel("2026-09-12", 1)).toBe(
      new Date(2026, 8, 12).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    );
    expect(planDateLabel("2026-09-12", 3)).toContain("–");
    expect(resultsBadge(0, 0)).toBeNull();
    expect(resultsBadge(2, 0)).toBe("Results in · 2");
    expect(resultsBadge(2, 1)).toBe("Results in · 2 + 1 in review");
    expect(resultsBadge(0, 1)).toBe("1 in review");
  });
});
