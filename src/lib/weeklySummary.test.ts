import { describe, expect, it } from "vitest";
import {
  isEdited,
  isLatestMonth,
  isLatestWeek,
  mailtoHref,
  monthLabel,
  recapBasis,
  shiftMonth,
  shiftWeek,
  statusLine,
  summaryIsStale,
  summaryParagraphs,
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

describe("month arithmetic", () => {
  it("moves by whole months and lands on the first", () => {
    expect(shiftMonth("2026-10-14", 0)).toBe("2026-10-01");
    expect(shiftMonth("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("nonsense", 1)).toBe("nonsense");
  });

  it("labels a month", () => {
    expect(monthLabel("2026-10-01")).toBe("October 2026");
    expect(monthLabel("x")).toBe("x");
  });

  it("knows the last finished month", () => {
    const midNovember = new Date(2026, 10, 15);
    expect(isLatestMonth("2026-10-01", midNovember)).toBe(true);
    expect(isLatestMonth("2026-09-01", midNovember)).toBe(false);
  });

  it("builds an email link with no recipient", () => {
    expect(mailtoHref("Alpha: October 2026", "Hi team,\n\nIt went well & sold 5.")).toBe(
      "mailto:?subject=Alpha%3A%20October%202026&body=Hi%20team%2C%0D%0A%0D%0AIt%20went%20well%20%26%20sold%205.",
    );
  });

  it("names the period in the basis line", () => {
    expect(recapBasis(0, 0, "month")).toBe("No approved recaps this month.");
  });
});

describe("the dashboard card", () => {
  const now = new Date("2026-11-14T18:00:00Z");

  it("keeps last week's summary and drops one from five weeks ago", () => {
    expect(summaryIsStale("2026-11-08", now)).toBe(false);
    expect(summaryIsStale("2026-10-11", now)).toBe(true);
    expect(summaryIsStale("", now)).toBe(true);
  });

  it("splits the text into paragraphs on blank lines", () => {
    expect(summaryParagraphs("Three events ran.\n\n  Shoppers liked\nthe citrus. \n\n\n")).toEqual([
      "Three events ran.",
      "Shoppers liked the citrus.",
    ]);
    expect(summaryParagraphs("  ")).toEqual([]);
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

  it("says who reviewed it, and who sent it", () => {
    expect(statusLine({ status: "draft" })).toBe("Draft");
    expect(
      statusLine({
        status: "reviewed",
        reviewedByName: "Sam Staff",
        reviewedAt: "2026-11-16T15:00:00+00:00",
      }),
    ).toBe("Reviewed by Sam Staff on Nov 16");
    expect(statusLine({ status: "reviewed" })).toBe("Reviewed");
    expect(
      statusLine({
        status: "reviewed",
        sentAt: "2026-11-17T15:00:00+00:00",
        sentByName: "Sam Staff",
        sentTo: ["a@brand.test", "b@brand.test"],
      }),
    ).toBe("Sent by Sam Staff to 2 recipients on Nov 17");
  });

  it("says it was compiled from approved recaps, and when it has been edited", () => {
    expect(writtenLine({ generatedAt: "2026-11-16T15:00:00+00:00", editedBody: "" })).toBe(
      "Compiled from approved recaps on Nov 16.",
    );
    expect(writtenLine({ generatedAt: "bad", editedBody: "Mine." })).toBe(
      "Compiled from approved recaps. Edited since.",
    );
  });

  it("compares the text box with what is stored, ignoring outer space", () => {
    expect(isEdited(" Same. ", "Same.")).toBe(false);
    expect(isEdited("Changed.", "Same.")).toBe(true);
  });
});
