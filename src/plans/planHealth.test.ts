import { describe, expect, it } from "vitest";
import {
  formatPlanWindow,
  planHealth,
  planWindowKind,
} from "./planHealth";

describe("planHealth", () => {
  it("marks empty plans", () => {
    expect(planHealth({ planned: 0, approved: 0, staffed: 0, executed: 0, verified: 0 }).kind).toBe(
      "empty",
    );
  });

  it("flags staffing gaps", () => {
    expect(
      planHealth({ planned: 10, approved: 10, staffed: 2, executed: 0, verified: 0 })
        .kind,
    ).toBe("needs_staffing");
  });

  it("flags recap gaps when staffed", () => {
    expect(
      planHealth({ planned: 10, approved: 10, staffed: 9, executed: 2, verified: 1 })
        .kind,
    ).toBe("needs_recaps");
  });

  it("marks complete when verified covers planned", () => {
    expect(
      planHealth({ planned: 5, approved: 5, staffed: 5, executed: 5, verified: 5 })
        .kind,
    ).toBe("done");
  });
});

describe("planWindowKind", () => {
  const today = new Date("2026-09-16T12:00:00");

  it("classifies upcoming / active / past", () => {
    expect(planWindowKind("2026-10-01", "2026-10-31", today)).toBe("upcoming");
    expect(planWindowKind("2026-09-01", "2026-09-30", today)).toBe("active");
    expect(planWindowKind("2026-07-01", "2026-08-01", today)).toBe("past");
    expect(planWindowKind(null, null, today)).toBe("undated");
  });
});

describe("formatPlanWindow", () => {
  it("formats ranges", () => {
    expect(formatPlanWindow("2026-09-01", "2026-09-30")).toContain("→");
    expect(formatPlanWindow(null, null)).toBe("No dates set");
  });
});
