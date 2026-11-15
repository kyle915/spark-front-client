import { describe, expect, it } from "vitest";
import {
  isEdited,
  isLatestWeek,
  recapBasis,
  shiftWeek,
  statusLine,
  weekLabel,
  writtenLine,
} from "./weeklySummary";

describe("week arithmetic", () => {
  it("moves by whole weeks and lands on the Monday", () => {
    expect(shiftWeek("2026-11-09", -1)).toBe("2026-11-02");
    expect(shiftWeek("2026-11-09", 1)).toBe("2026-11-16");
    expect(shiftWeek("2026-11-12", 0)).toBe("2026-11-09"); // a Thursday
    expect(shiftWeek("2026-11-15", 0)).toBe("2026-11-09"); // a Sunday
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(shiftWeek("nonsense", 1)).toBe("nonsense");
  });

  it("labels a week, across a month end too", () => {
    expect(weekLabel("2026-11-09", "2026-11-15")).toBe("Nov 9 to 15, 2026");
    expect(weekLabel("2026-11-30", "2026-12-06")).toBe("Nov 30 to Dec 6, 2026");
    expect(weekLabel("x", "y")).toBe("x to y");
  });

  it("knows the last finished week", () => {
    const sunday = new Date(2026, 10, 15); // Nov 15, 2026
    expect(isLatestWeek("2026-11-02", sunday)).toBe(true);
    expect(isLatestWeek("2026-10-26", sunday)).toBe(false);
    const monday = new Date(2026, 10, 16);
    expect(isLatestWeek("2026-11-09", monday)).toBe(true);
    expect(isLatestWeek("2026-11-02", monday)).toBe(false);
  });
});

describe("draft lines", () => {
  it("says what the draft was written from", () => {
    expect(recapBasis(5, 0)).toBe("5 approved recaps.");
    expect(recapBasis(1, 1)).toBe(
      "1 approved recap. 1 more is waiting for review and is not included.",
    );
    expect(recapBasis(0, 3)).toBe(
      "No approved recaps this week. 3 more are waiting for review and are not included.",
    );
  });

  it("says who reviewed it", () => {
    expect(statusLine({ status: "draft" })).toBe("Draft");
    expect(
      statusLine({
        status: "reviewed",
        reviewedByName: "Sam Staff",
        reviewedAt: "2026-11-16T15:00:00+00:00",
      }),
    ).toBe("Reviewed by Sam Staff on Nov 16");
    expect(statusLine({ status: "reviewed" })).toBe("Reviewed");
  });

  it("says it was written by AI, and when it has been edited", () => {
    expect(writtenLine({ generatedAt: "2026-11-16T15:00:00+00:00", editedBody: "" })).toBe(
      "Written by AI from approved recaps on Nov 16.",
    );
    expect(writtenLine({ generatedAt: "bad", editedBody: "Mine." })).toBe(
      "Written by AI from approved recaps. Edited since.",
    );
  });

  it("compares the text box with what is stored, ignoring outer space", () => {
    expect(isEdited(" Same. ", "Same.")).toBe(false);
    expect(isEdited("Changed.", "Same.")).toBe(true);
  });
});
