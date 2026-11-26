import { describe, expect, it } from "vitest";
import { generateWeeklyRepeatDates } from "./repeatDates";

describe("generateWeeklyRepeatDates", () => {
  it("generates 3 weekly dates from a primary date", () => {
    expect(generateWeeklyRepeatDates("2026-06-05", [])).toEqual([
      "2026-06-12",
      "2026-06-19",
      "2026-06-26",
    ]);
  });

  it("crosses month, year, and DST boundaries without day drift", () => {
    expect(generateWeeklyRepeatDates("2026-10-25", [])).toEqual([
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
    ]);
    expect(generateWeeklyRepeatDates("2026-12-20", [])).toEqual([
      "2026-12-27",
      "2027-01-03",
      "2027-01-10",
    ]);
  });

  it("extends from the latest existing date when clicked again", () => {
    expect(
      generateWeeklyRepeatDates("2026-06-05", [
        "2026-06-12",
        "2026-06-19",
        "2026-06-26",
      ]),
    ).toEqual(["2026-07-03", "2026-07-10", "2026-07-17"]);
  });

  it("returns empty array for empty or malformed dates", () => {
    expect(generateWeeklyRepeatDates("", [])).toEqual([]);
    expect(generateWeeklyRepeatDates("not-a-date", [])).toEqual([]);
  });
});
